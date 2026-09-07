import { describe, expect, it } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { applyRateLimitAttempt } from './fixtures/rate-limit';
import {
	isRateLimitBlocked,
	rateLimitAttemptSet,
	rateLimitFirstAttemptBlockedUntil,
	type RateLimitPolicy
} from './rate-limit';
import { artworkEngagementRateLimits } from './schema';

const dialect = new PgDialect();

const HOUR = 60 * 60 * 1000;

const policy: RateLimitPolicy = {
	blockAnchor: 'window-start',
	blockMs: HOUR,
	maxAttempts: 3,
	windowMs: HOUR
};

const at = (isoMinutes: string) => new Date(`2026-03-27T${isoMinutes}:00.000Z`);

const openRow = (now: Date) =>
	applyRateLimitAttempt(null, { actorKey: 'viewer-1', id: 'limit-1', now, policy });

describe('rate-limit upsert clause', () => {
	it('sends the windows as bound parameters instead of splicing them into the SQL', () => {
		const set = rateLimitAttemptSet(artworkEngagementRateLimits, policy);
		const { params, sql } = dialect.sqlToQuery(set.blockedUntil as SQL);

		// `make_interval(secs => $n)` — a raw-spliced window would put 3600 in the
		// statement text and let a policy value reach the planner as source code.
		expect(params).toContain(HOUR / 1000);
		expect(sql).not.toContain(String(HOUR / 1000));
		expect(sql).toContain('make_interval');
		// The clause decides from the row it is already locking: the stored column
		// against the proposed one, never a value the caller computed first.
		expect(sql).toContain('excluded."last_attempt_at"');
	});

	it('blocks a brand new row only when a single attempt is the whole allowance', () => {
		const now = at('12:00');

		expect(rateLimitFirstAttemptBlockedUntil(policy, now)).toBeNull();
		expect(rateLimitFirstAttemptBlockedUntil({ ...policy, maxAttempts: 1 }, now)).toEqual(
			new Date(now.getTime() + HOUR)
		);
	});

	it('reads the returned row as blocked while the block has not elapsed', () => {
		const now = at('12:00');

		expect(isRateLimitBlocked({ blockedUntil: null }, now)).toBe(false);
		expect(isRateLimitBlocked({ blockedUntil: at('11:59') }, now)).toBe(false);
		expect(isRateLimitBlocked({ blockedUntil: at('12:01') }, now)).toBe(true);
	});
});

describe('rate-limit counting rule', () => {
	it('counts attempts inside the window and blocks on the last allowed one', () => {
		const first = openRow(at('12:00'));
		expect(first).toMatchObject({ attemptCount: 1, blockedUntil: null });

		const second = applyRateLimitAttempt(first, {
			actorKey: 'viewer-1',
			id: 'ignored',
			now: at('12:10'),
			policy
		});
		expect(second).toMatchObject({ attemptCount: 2, blockedUntil: null });

		const third = applyRateLimitAttempt(second, {
			actorKey: 'viewer-1',
			id: 'ignored',
			now: at('12:20'),
			policy
		});
		expect(third.attemptCount).toBe(3);
		// Artwork limits anchor the block at the start of the window it filled.
		expect(third.blockedUntil).toEqual(new Date(at('12:00').getTime() + HOUR));
	});

	it('freezes a blocked actor: the attempt is recorded, the counter and the window are not', () => {
		const blocked = {
			...openRow(at('12:00')),
			attemptCount: 3,
			blockedUntil: at('13:00')
		};

		const hammered = applyRateLimitAttempt(blocked, {
			actorKey: 'viewer-1',
			id: 'ignored',
			now: at('12:30'),
			policy
		});

		expect(hammered.attemptCount).toBe(3);
		expect(hammered.blockedUntil).toEqual(at('13:00'));
		expect(hammered.windowStartedAt).toEqual(at('12:00'));
		expect(hammered.lastAttemptAt).toEqual(at('12:30'));
	});

	it('opens a fresh window once the old one has elapsed', () => {
		const stale = openRow(at('12:00'));

		const reopened = applyRateLimitAttempt(stale, {
			actorKey: 'viewer-1',
			id: 'ignored',
			now: at('13:30'),
			policy
		});

		expect(reopened).toMatchObject({ attemptCount: 1, blockedUntil: null });
		expect(reopened.windowStartedAt).toEqual(at('13:30'));
	});

	/*
	 * The four cases above run against `applyRateLimitAttempt`, the in-memory
	 * twin the service tests use as their repository double. The rule that
	 * actually ships is the SQL below, and grading the twin against itself
	 * would let the two drift apart silently — so the shipped clause is read
	 * back branch by branch.
	 */
	const render = (fragment: SQL) => dialect.sqlToQuery(fragment).sql.replace(/\s+/g, ' ').trim();

	it('renders the freeze, the bump and the fresh window into the shipped clause', () => {
		const set = rateLimitAttemptSet(artworkEngagementRateLimits, policy);
		const attemptCount = render(set.attemptCount as SQL);
		const windowStartedAt = render(set.windowStartedAt as SQL);

		const isBlocked =
			'"blocked_until" is not null and "blocked_until" > excluded."last_attempt_at"';
		const isWithinWindow =
			'excluded."last_attempt_at" <= "window_started_at" + make_interval(secs => $1::double precision)';

		// Frozen while blocked: the stored count is kept, not bumped.
		expect(attemptCount).toContain(`when ${isBlocked} then "attempt_count"`);
		// Inside the window it bumps, outside it starts a fresh window at 1.
		expect(attemptCount).toContain(`when ${isWithinWindow} then "attempt_count" + 1`);
		expect(attemptCount).toContain('else 1 end');

		// The window is kept in both of those cases and only re-anchored on the
		// attempt that opens a new one, so hammering can neither extend a block
		// nor reset it early.
		expect(windowStartedAt).toContain(`when ${isBlocked} or ${isWithinWindow}`);
		expect(windowStartedAt).toContain('then "window_started_at"');
		expect(windowStartedAt).toContain('else excluded."window_started_at" end');
	});

	it('keeps a standing block untouched and anchors a new one per policy', () => {
		const artworkBlockedUntil = render(
			rateLimitAttemptSet(artworkEngagementRateLimits, policy).blockedUntil as SQL
		);
		const authBlockedUntil = render(
			rateLimitAttemptSet(artworkEngagementRateLimits, { ...policy, blockAnchor: 'attempt' })
				.blockedUntil as SQL
		);

		// An actor already blocked keeps the block they have.
		expect(artworkBlockedUntil).toContain(
			'when "blocked_until" is not null and "blocked_until" > excluded."last_attempt_at" then "blocked_until"'
		);
		expect(artworkBlockedUntil).toContain('else null end');

		// Artwork limits anchor at the start of the window that filled up…
		expect(artworkBlockedUntil).toContain('else excluded."window_started_at" end + make_interval');
		// …auth at the failure that tripped it.
		expect(authBlockedUntil).toContain(
			'excluded."last_attempt_at" + make_interval(secs => $3::double precision)'
		);
	});

	it('anchors an auth block at the failure that tripped it, not at the window start', () => {
		const authPolicy: RateLimitPolicy = { ...policy, blockAnchor: 'attempt', maxAttempts: 2 };
		const first = applyRateLimitAttempt(null, {
			actorKey: 'login:nick:ip',
			id: 'limit-1',
			now: at('12:00'),
			policy: authPolicy
		});

		const tripped = applyRateLimitAttempt(first, {
			actorKey: 'login:nick:ip',
			id: 'ignored',
			now: at('12:40'),
			policy: authPolicy
		});

		expect(tripped.blockedUntil).toEqual(new Date(at('12:40').getTime() + HOUR));
	});
});
