import { rateLimitFirstAttemptBlockedUntil, type RateLimitPolicy } from '../rate-limit';

export type StoredRateLimit = {
	actorKey: string;
	attemptCount: number;
	blockedUntil: Date | null;
	createdAt: Date;
	id: string;
	lastAttemptAt: Date;
	updatedAt: Date;
	windowStartedAt: Date;
};

export type RateLimitAttempt = {
	actorKey: string;
	id: string;
	now: Date;
	policy: RateLimitPolicy;
};

// The in-memory twin of the `on conflict do update` clause in ../rate-limit.ts.
// Every test double shares it, so the counting rule cannot pass the unit suite
// by being reimplemented three slightly different ways; the SQL itself is
// covered by the RUN_INTEGRATION contract case in
// lib/server/artwork/db.contract.integration.test.ts.
export const applyRateLimitAttempt = (
	current: StoredRateLimit | null,
	attempt: RateLimitAttempt
): StoredRateLimit => {
	const { now, policy } = attempt;

	if (!current) {
		return {
			actorKey: attempt.actorKey,
			attemptCount: 1,
			blockedUntil: rateLimitFirstAttemptBlockedUntil(policy, now),
			createdAt: now,
			id: attempt.id,
			lastAttemptAt: now,
			updatedAt: now,
			windowStartedAt: now
		};
	}

	// A blocked actor is frozen: the attempt is recorded, the counter is not.
	if (current.blockedUntil !== null && current.blockedUntil.getTime() > now.getTime()) {
		return { ...current, lastAttemptAt: now, updatedAt: now };
	}

	const isWithinWindow = now.getTime() - current.windowStartedAt.getTime() <= policy.windowMs;
	const attemptCount = isWithinWindow ? current.attemptCount + 1 : 1;
	const windowStartedAt = isWithinWindow ? current.windowStartedAt : now;
	const blockAnchor = policy.blockAnchor === 'attempt' ? now : windowStartedAt;

	return {
		...current,
		attemptCount,
		blockedUntil:
			attemptCount >= policy.maxAttempts ? new Date(blockAnchor.getTime() + policy.blockMs) : null,
		lastAttemptAt: now,
		updatedAt: now,
		windowStartedAt
	};
};
