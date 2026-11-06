import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { hashPassword } from 'better-auth/crypto';
import { auth } from '#lib/server/auth.js';
import { db } from '#lib/server/db/index.js';
import { account, users } from '#lib/server/db/schema.js';
import { checkTextModeration } from '#lib/server/moderation/service.js';
import { logSecurityEvent } from '#lib/server/security/logging.js';
import { AuthFlowError } from './errors';
import { generateRecoveryKey, hashRecoveryKey, verifyRecoveryKey } from './recovery';
import { AuthRateLimitError, assertRateLimit, recordFailure, recordSuccess } from './rate-limit';
import type { AuthIntegrityFailure, AuthSessionContext, CanonicalUser } from './types';
import type { RecoverInput, SignInInput, SignupInput } from './validation';

type AuthResult<T> = {
	response: T;
};

type AuthUserLike = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
};

const toSafeAuthError = (message: string, code: AuthFlowError['code'], status = 400) =>
	new AuthFlowError(status, message, code);

const toRateLimitFlowError = (error: AuthRateLimitError) =>
	new AuthFlowError(429, error.message, 'RATE_LIMITED');

const logAuthAbuseLimitDenied = (
	kind: 'login' | 'recovery',
	identifier: string,
	ipAddress: string | null,
	error: AuthRateLimitError
) => {
	logSecurityEvent('auth.abuse_limit_denied', {
		blockedUntil: error.blockedUntil.toISOString(),
		identifier,
		ipAddress,
		kind
	});
};

// Exactly the columns mapProfileToCanonicalUser reads. Without this list the
// relational query is a SELECT *, so every authenticated request — including
// each of the ~48 image requests a gallery room fires — drags the viewer's whole
// compressed avatar document and their recovery hash out of Postgres, only for
// CanonicalUser to drop both.
const CANONICAL_PROFILE_COLUMNS = {
	avatarOnboardingCompletedAt: true,
	avatarUrl: true,
	createdAt: true,
	id: true,
	isBanned: true,
	nickname: true,
	role: true,
	updatedAt: true
} as const;

type CanonicalUserProfile = Pick<typeof users.$inferSelect, keyof typeof CANONICAL_PROFILE_COLUMNS>;

const mapProfileToCanonicalUser = (
	profile: CanonicalUserProfile,
	authUser: AuthUserLike
): CanonicalUser => ({
	id: profile.id,
	authUserId: authUser.id,
	nickname: profile.nickname,
	role: profile.role,
	avatarUrl: profile.avatarUrl ?? null,
	avatarOnboardingCompletedAt: profile.avatarOnboardingCompletedAt ?? null,
	isBanned: profile.isBanned,
	name: authUser.name,
	email: authUser.email,
	emailVerified: authUser.emailVerified,
	image: authUser.image ?? null,
	createdAt: profile.createdAt,
	updatedAt: profile.updatedAt
});

const buildSyntheticEmail = (nickname: string) => `${nickname}@not-the-louvre.local`;

// Recovery is the only caller that needs the hash, and nothing on this path
// ever needs the avatar document.
const getProfileByNickname = async (nickname: string) =>
	db.query.users.findFirst({
		columns: { ...CANONICAL_PROFILE_COLUMNS, recoveryHash: true },
		where: eq(users.nickname, nickname)
	});

const getProfileById = async (id: string) =>
	db.query.users.findFirst({
		columns: CANONICAL_PROFILE_COLUMNS,
		where: eq(users.id, id)
	});

const safeAuthFailure = async <T>(
	kind: 'login' | 'recovery',
	identifier: string,
	ipAddress: string | null,
	error: Error
): Promise<T> => {
	if (error instanceof AuthRateLimitError) {
		logAuthAbuseLimitDenied(kind, identifier, ipAddress, error);
		throw toRateLimitFlowError(error);
	}

	try {
		await recordFailure(kind, identifier, ipAddress);
	} catch (recordError) {
		if (recordError instanceof AuthRateLimitError) {
			logAuthAbuseLimitDenied(kind, identifier, ipAddress, recordError);
			throw toRateLimitFlowError(recordError);
		}

		throw recordError;
	}

	if (error instanceof AuthFlowError) {
		throw error;
	}

	if (error instanceof APIError) {
		throw new AuthFlowError(401, 'Invalid nickname or password', 'INVALID_CREDENTIALS');
	}

	throw error;
};

export const signUpWithNickname = async (
	input: SignupInput,
	requestHeaders?: HeadersInit
): Promise<AuthResult<{ recoveryKey: string; user: CanonicalUser }>> => {
	const moderationResult = await checkTextModeration(input.nickname, 'nickname');
	if (moderationResult.status !== 'allowed') {
		throw toSafeAuthError(moderationResult.message, 'INVALID_NICKNAME');
	}

	const existing = await getProfileByNickname(input.nickname);
	if (existing) {
		throw toSafeAuthError('Nickname is already taken', 'NICKNAME_TAKEN', 409);
	}

	const recoveryKey = generateRecoveryKey();
	const recoveryHash = await hashRecoveryKey(recoveryKey);
	const response = await auth.api.signUpEmail({
		body: {
			name: input.nickname,
			email: buildSyntheticEmail(input.nickname),
			password: input.password,
			username: input.nickname,
			nickname: input.nickname,
			callbackURL: '/demo/better-auth'
		},
		headers: new Headers(requestHeaders)
	});

	await db.insert(users).values({
		id: response.user.id,
		nickname: input.nickname,
		recoveryHash,
		avatarOnboardingCompletedAt: null,
		role: 'user'
	});

	const profile = await getProfileById(response.user.id);
	if (!profile) {
		throw new AuthFlowError(500, 'Missing product user after signup', 'INTEGRITY_FAILURE');
	}

	return {
		response: {
			recoveryKey,
			user: mapProfileToCanonicalUser(profile, response.user)
		}
	};
};

export const getNicknameAvailability = async (nickname: string) => {
	try {
		const response = await auth.api.isUsernameAvailable({
			body: { username: nickname },
			headers: new Headers()
		});

		return { available: response.available, valid: true };
	} catch (error) {
		if (error instanceof APIError) {
			return { available: false, valid: false };
		}

		throw error;
	}
};

export const signInWithNickname = async (
	input: SignInInput,
	ipAddress: string | null,
	requestHeaders?: HeadersInit
): Promise<AuthResult<{ user: CanonicalUser }>> => {
	try {
		await assertRateLimit('login', input.nickname, ipAddress);
	} catch (error) {
		if (error instanceof AuthRateLimitError) {
			logAuthAbuseLimitDenied('login', input.nickname, ipAddress, error);
			throw toRateLimitFlowError(error);
		}

		throw error;
	}

	try {
		const response = await auth.api.signInUsername({
			body: {
				username: input.nickname,
				password: input.password
			},
			headers: new Headers(requestHeaders)
		});

		if (!response) {
			throw new AuthFlowError(401, 'Invalid nickname or password', 'INVALID_CREDENTIALS');
		}

		await recordSuccess('login', input.nickname, ipAddress);

		const profile = await getProfileById(response.user.id);
		if (!profile) {
			throw new AuthFlowError(500, 'Missing product user for session', 'INTEGRITY_FAILURE');
		}

		return {
			response: {
				user: mapProfileToCanonicalUser(profile, response.user)
			}
		};
	} catch (error) {
		return await safeAuthFailure('login', input.nickname, ipAddress, error as Error);
	}
};

export const signOutCurrentSession = async (headers: HeadersInit) => {
	await auth.api.signOut({
		headers: new Headers(headers)
	});
};

export const recoverAccount = async (
	input: RecoverInput,
	ipAddress: string | null
): Promise<{ recoveryKey: string }> => {
	try {
		await assertRateLimit('recovery', input.nickname, ipAddress);
	} catch (error) {
		if (error instanceof AuthRateLimitError) {
			logAuthAbuseLimitDenied('recovery', input.nickname, ipAddress, error);
			throw toRateLimitFlowError(error);
		}

		throw error;
	}

	try {
		const profile = await getProfileByNickname(input.nickname);
		if (!profile) {
			throw new AuthFlowError(401, 'Recovery failed', 'RECOVERY_FAILED');
		}

		const isValid = await verifyRecoveryKey(profile.recoveryHash, input.recoveryKey);
		if (!isValid) {
			throw new AuthFlowError(401, 'Recovery failed', 'RECOVERY_FAILED');
		}

		const hashedPassword = await hashPassword(input.newPassword);
		await db
			.update(account)
			.set({
				password: hashedPassword,
				updatedAt: new Date()
			})
			.where(eq(account.userId, profile.id));

		const nextRecoveryKey = generateRecoveryKey();
		const nextRecoveryHash = await hashRecoveryKey(nextRecoveryKey);
		await db
			.update(users)
			.set({ recoveryHash: nextRecoveryHash, updatedAt: new Date() })
			.where(eq(users.id, profile.id));

		await recordSuccess('recovery', input.nickname, ipAddress);

		return { recoveryKey: nextRecoveryKey };
	} catch (error) {
		return await safeAuthFailure('recovery', input.nickname, ipAddress, error as Error);
	}
};

export const resolveSessionContext = async (
	headers: Headers
): Promise<AuthSessionContext | null | AuthIntegrityFailure> => {
	let session;

	try {
		session = await auth.api.getSession({ headers });
	} catch (error) {
		if (error instanceof APIError) {
			return null;
		}

		throw error;
	}

	if (!session) {
		return null;
	}

	const profile = await getProfileById(session.user.id);
	if (!profile) {
		return {
			session: session.session,
			authUser: session.user,
			reason: 'missing-product-user'
		};
	}

	return {
		session: session.session,
		authUser: session.user,
		user: mapProfileToCanonicalUser(profile, session.user)
	};
};
