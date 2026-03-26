import { and, eq } from 'drizzle-orm';
import { generateId } from 'better-auth';
import { db } from '$lib/server/db';
import { authRateLimits, type authAttemptKind } from '$lib/server/db/schema';
import { AUTH_RATE_LIMITS } from './config';

type AttemptKind = keyof typeof AUTH_RATE_LIMITS;

export class AuthRateLimitError extends Error {
	constructor(readonly blockedUntil: Date) {
		super('Too many attempts. Please wait before trying again.');
	}
}

type AuthRateLimitRecord = typeof authRateLimits.$inferSelect;

const getNow = () => new Date();

const getActorKey = (kind: AttemptKind, identifier: string, ipAddress: string | null) =>
	`${kind}:${identifier}:${ipAddress ?? 'unknown'}`;

const findRateLimit = async (kind: AttemptKind, actorKey: string) => {
	const record = await db.query.authRateLimits.findFirst({
		where: and(
			eq(authRateLimits.kind, kind as (typeof authAttemptKind.enumValues)[number]),
			eq(authRateLimits.actorKey, actorKey)
		)
	});

	return record ?? null;
};

const upsertRateLimit = async (
	record: AuthRateLimitRecord | null,
	kind: AttemptKind,
	actorKey: string,
	data: Partial<AuthRateLimitRecord>
) => {
	if (!record) {
		await db.insert(authRateLimits).values({
			id: generateId(),
			kind,
			actorKey,
			attemptCount: data.attemptCount ?? 0,
			windowStartedAt: data.windowStartedAt ?? getNow(),
			lastAttemptAt: data.lastAttemptAt ?? getNow(),
			blockedUntil: data.blockedUntil ?? null
		});
		return;
	}

	await db
		.update(authRateLimits)
		.set({
			attemptCount: data.attemptCount ?? record.attemptCount,
			windowStartedAt: data.windowStartedAt ?? record.windowStartedAt,
			lastAttemptAt: data.lastAttemptAt ?? record.lastAttemptAt,
			blockedUntil: data.blockedUntil ?? record.blockedUntil,
			updatedAt: getNow()
		})
		.where(eq(authRateLimits.id, record.id));
};

const clearRateLimit = async (record: AuthRateLimitRecord | null) => {
	if (!record) return;

	await db
		.update(authRateLimits)
		.set({
			attemptCount: 0,
			windowStartedAt: getNow(),
			lastAttemptAt: getNow(),
			blockedUntil: null,
			updatedAt: getNow()
		})
		.where(eq(authRateLimits.id, record.id));
};

export const assertRateLimit = async (
	kind: AttemptKind,
	identifier: string,
	ipAddress: string | null
) => {
	const actorKey = getActorKey(kind, identifier, ipAddress);
	const record = await findRateLimit(kind, actorKey);
	const now = getNow();

	if (record?.blockedUntil && record.blockedUntil > now) {
		throw new AuthRateLimitError(record.blockedUntil);
	}

	return { actorKey, record };
};

export const recordFailure = async (
	kind: AttemptKind,
	identifier: string,
	ipAddress: string | null
) => {
	const { actorKey, record } = await assertRateLimit(kind, identifier, ipAddress);
	const config = AUTH_RATE_LIMITS[kind];
	const now = getNow();
	const windowStartedAt =
		record && now.getTime() - record.windowStartedAt.getTime() <= config.windowMs
			? record.windowStartedAt
			: now;
	const attemptCount =
		record && now.getTime() - record.windowStartedAt.getTime() <= config.windowMs
			? record.attemptCount + 1
			: 1;
	const blockedUntil =
		attemptCount >= config.maxFailures ? new Date(now.getTime() + config.blockMs) : null;

	await upsertRateLimit(record, kind, actorKey, {
		attemptCount,
		windowStartedAt,
		lastAttemptAt: now,
		blockedUntil
	});

	if (blockedUntil) {
		throw new AuthRateLimitError(blockedUntil);
	}
};

export const recordSuccess = async (
	kind: AttemptKind,
	identifier: string,
	ipAddress: string | null
) => {
	const actorKey = getActorKey(kind, identifier, ipAddress);
	const record = await findRateLimit(kind, actorKey);
	await clearRateLimit(record);
};
