import { sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

// The three rate-limit tables (auth, artwork publish, artwork engagement) share
// one row shape and one counting rule. Reading the row and then writing it back
// let two concurrent attempts both read the same count and both write count+1,
// so the limit could be walked past under load. Everything below builds the
// `on conflict do update` half of a single upsert, which decides inside the
// database from the row it is already locking.

export type RateLimitPolicy = {
	// Where the block starts counting once the limit trips: from the start of
	// the window (artwork limits) or from the attempt that tripped it (auth).
	blockAnchor: 'attempt' | 'window-start';
	blockMs: number;
	maxAttempts: number;
	windowMs: number;
};

export type RateLimitColumns = {
	attemptCount: PgColumn;
	blockedUntil: PgColumn;
	lastAttemptAt: PgColumn;
	updatedAt: PgColumn;
	windowStartedAt: PgColumn;
};

// A bare column name in `do update set` is the row already in the table;
// `excluded.<column>` is the row this insert proposed (so `excluded.
// last_attempt_at` is the caller's `now`). Names go through sql.identifier and
// the windows travel as bound parameters — nothing is spliced in as raw SQL.
const stored = (column: PgColumn) => sql`${sql.identifier(column.name)}`;

const proposed = (column: PgColumn) => sql`excluded.${sql.identifier(column.name)}`;

// The window travels as a bound parameter and is cast explicitly, so the
// planner never has to guess the type of an untyped placeholder.
const interval = (milliseconds: number) =>
	sql`make_interval(secs => ${milliseconds / 1000}::double precision)`;

export const rateLimitAttemptSet = (columns: RateLimitColumns, policy: RateLimitPolicy) => {
	const now = proposed(columns.lastAttemptAt);
	const attemptCount = stored(columns.attemptCount);
	const blockedUntil = stored(columns.blockedUntil);
	const windowStartedAt = stored(columns.windowStartedAt);

	// A blocked actor is frozen: the attempt is recorded, but the counter does
	// not bump and the window does not roll forward, so hammering a blocked
	// endpoint can neither extend the block nor reset it early.
	const isBlocked = sql`${blockedUntil} is not null and ${blockedUntil} > ${now}`;
	const isWithinWindow = sql`${now} <= ${windowStartedAt} + ${interval(policy.windowMs)}`;

	const nextWindowStartedAt = sql`case
		when ${isBlocked} or ${isWithinWindow} then ${windowStartedAt}
		else ${proposed(columns.windowStartedAt)}
	end`;

	const nextAttemptCount = sql`case
		when ${isBlocked} then ${attemptCount}
		when ${isWithinWindow} then ${attemptCount} + 1
		else 1
	end`;

	const blockAnchor = policy.blockAnchor === 'attempt' ? now : nextWindowStartedAt;

	return {
		attemptCount: nextAttemptCount,
		blockedUntil: sql`case
			when ${isBlocked} then ${blockedUntil}
			when (${nextAttemptCount}) >= ${policy.maxAttempts} then ${blockAnchor} + ${interval(policy.blockMs)}
			else null
		end`,
		lastAttemptAt: now,
		updatedAt: proposed(columns.updatedAt),
		windowStartedAt: nextWindowStartedAt
	};
};

// The `blocked_until` a brand new row carries: one attempt in a window that
// starts now, already blocked when a single attempt is all the policy allows.
export const rateLimitFirstAttemptBlockedUntil = (policy: RateLimitPolicy, now: Date) =>
	policy.maxAttempts <= 1 ? new Date(now.getTime() + policy.blockMs) : null;

// The row the upsert returns is the authoritative one: it already reflects
// this attempt, so the caller only has to look at the block it came back with.
export const isRateLimitBlocked = (record: { blockedUntil: Date | null }, now: Date) =>
	record.blockedUntil !== null && record.blockedUntil.getTime() >= now.getTime();
