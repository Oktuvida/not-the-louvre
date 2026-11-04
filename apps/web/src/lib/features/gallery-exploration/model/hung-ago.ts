const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Largest first: the first one a piece's age reaches is the one it is told in.
const UNITS = [
	['year', 365 * DAY],
	['month', 30 * DAY],
	['week', 7 * DAY],
	['day', DAY],
	['hour', HOUR],
	['minute', MINUTE]
] as const;

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * When a piece went up, in the words of a note pencilled beside it. A piece
 * from under a minute ago, or from a clock a little ahead of this one, is
 * simply just hung.
 */
export const hungAgo = (hungAt: number, now: number) => {
	const age = now - hungAt;
	for (const [unit, length] of UNITS) {
		if (age >= length) return `hung ${relativeTime.format(-Math.floor(age / length), unit)}`;
	}
	return 'just hung';
};
