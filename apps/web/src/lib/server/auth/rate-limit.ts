import { and, eq } from 'drizzle-orm';
import { generateId } from 'better-auth';
import { db } from '#lib/server/db/index.js';
import {
	isRateLimitBlocked,
	rateLimitAttemptSet,
	rateLimitFirstAttemptBlockedUntil,
	type RateLimitPolicy
} from '#lib/server/db/rate-limit.js';
import { authRateLimits } from '#lib/server/db/schema.js';
import { AUTH_RATE_LIMITS } from './config';

type AttemptKind = keyof typeof AUTH_RATE_LIMITS;

export class AuthRateLimitError extends Error {
	constructor(readonly blockedUntil: Date) {
		super('Too many attempts. Please wait before trying again.');
	}
}

const getNow = () => new Date();

const getActorKey = (kind: AttemptKind, identifier: string, ipAddress: string | null) =>
	`${kind}:${identifier}:${ipAddress ?? 'unknown'}`;

// Auth blocks run from the failure that tripped them, not from the start of
// the counting window.
const getPolicy = (kind: AttemptKind): RateLimitPolicy => ({
	blockAnchor: 'attempt',
	blockMs: AUTH_RATE_LIMITS[kind].blockMs,
	maxAttempts: AUTH_RATE_LIMITS[kind].maxFailures,
	windowMs: AUTH_RATE_LIMITS[kind].windowMs
});

const findRateLimit = async (kind: AttemptKind, actorKey: string) => {
	const record = await db.query.authRateLimits.findFirst({
		where: and(eq(authRateLimits.kind, kind), eq(authRateLimits.actorKey, actorKey))
	});

	return record ?? null;
};

export const assertRateLimit = async (
	kind: AttemptKind,
	identifier: string,
	ipAddress: string | null
) => {
	const record = await findRateLimit(kind, getActorKey(kind, identifier, ipAddress));
	const now = getNow();

	if (record?.blockedUntil && record.blockedUntil > now) {
		throw new AuthRateLimitError(record.blockedUntil);
	}
};

export const recordFailure = async (
	kind: AttemptKind,
	identifier: string,
	ipAddress: string | null
) => {
	const policy = getPolicy(kind);
	const now = getNow();

	// One statement counts the failure and decides the block, so parallel
	// guesses against the same account are counted against the same row
	// instead of each reading the same pre-attempt count.
	const [record] = await db
		.insert(authRateLimits)
		.values({
			actorKey: getActorKey(kind, identifier, ipAddress),
			attemptCount: 1,
			blockedUntil: rateLimitFirstAttemptBlockedUntil(policy, now),
			createdAt: now,
			id: generateId(),
			kind,
			lastAttemptAt: now,
			updatedAt: now,
			windowStartedAt: now
		})
		.onConflictDoUpdate({
			target: [authRateLimits.kind, authRateLimits.actorKey],
			set: rateLimitAttemptSet(authRateLimits, policy)
		})
		.returning();

	if (record?.blockedUntil && isRateLimitBlocked(record, now)) {
		throw new AuthRateLimitError(record.blockedUntil);
	}
};

export const recordSuccess = async (
	kind: AttemptKind,
	identifier: string,
	ipAddress: string | null
) => {
	const now = getNow();

	// No read first: an actor with no row has nothing to clear, so the update
	// simply matches nothing.
	await db
		.update(authRateLimits)
		.set({
			attemptCount: 0,
			blockedUntil: null,
			lastAttemptAt: now,
			updatedAt: now,
			windowStartedAt: now
		})
		.where(
			and(
				eq(authRateLimits.kind, kind),
				eq(authRateLimits.actorKey, getActorKey(kind, identifier, ipAddress))
			)
		);
};
