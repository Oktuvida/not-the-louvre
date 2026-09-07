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
