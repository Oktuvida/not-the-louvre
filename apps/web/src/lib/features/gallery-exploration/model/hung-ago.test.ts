import { describe, expect, it } from 'vitest';
import { hungAgo } from './hung-ago';

const NOW = Date.parse('2026-11-04T18:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('when a piece went up, in words', () => {
	it('calls a piece from the last minute just hung', () => {
		expect(hungAgo(NOW, NOW)).toBe('just hung');
		expect(hungAgo(NOW - 59_000, NOW)).toBe('just hung');
	});

	it('counts in minutes, hours and days as it dries', () => {
		expect(hungAgo(NOW - MINUTE, NOW)).toBe('hung 1 minute ago');
		expect(hungAgo(NOW - 59 * MINUTE, NOW)).toBe('hung 59 minutes ago');
		expect(hungAgo(NOW - HOUR, NOW)).toBe('hung 1 hour ago');
		expect(hungAgo(NOW - 23 * HOUR, NOW)).toBe('hung 23 hours ago');
		expect(hungAgo(NOW - 3 * DAY, NOW)).toBe('hung 3 days ago');
	});

	it('says yesterday, last week and last month the way a person would', () => {
		expect(hungAgo(NOW - DAY, NOW)).toBe('hung yesterday');
		expect(hungAgo(NOW - 7 * DAY, NOW)).toBe('hung last week');
		expect(hungAgo(NOW - 31 * DAY, NOW)).toBe('hung last month');
	});

	it('treats a clock a little ahead of this one as just hung', () => {
		expect(hungAgo(NOW + 5 * MINUTE, NOW)).toBe('just hung');
	});
});
