import type { InkStroke } from '../../stroke/v3';

/*
 * When each point of a drawing appears in its replay: the times it was drawn
 * at, with the waiting taken out. A break between strokes is cut to under half
 * a second and a pen resting mid-stroke to a quarter, so twenty minutes of
 * drawing with a cup of tea in the middle replays as the drawing, not the tea.
 * A drawing from before v3 has no timing at all; it gets an even pace, which at
 * least replays the order its strokes were drawn in.
 */

const MAX_GAP_MS = 400;
const MAX_STILL_MS = 250;
const UNTIMED_STEP_MS = 16;
const UNTIMED_GAP_MS = 150;

export type Timeline = {
	/** When the last point appears, in replay milliseconds. */
	duration: number;
	/** Every stroke with the replay time of each of its points. */
	strokes: { stroke: InkStroke; times: number[] }[];
};

export const buildTimeline = (strokes: InkStroke[]): Timeline => {
	const untimed = strokes.every(
		(stroke) => stroke.start === 0 && stroke.times.every((time) => time === 0)
	);

	let previousEnd = 0;
	const entries = strokes.map((stroke, index) => {
		const previous = strokes[index - 1];
		const gap = untimed
			? UNTIMED_GAP_MS
			: previous
				? Math.min(MAX_GAP_MS, Math.max(0, stroke.start - previous.times.at(-1)!))
				: 0;
		const begin = index === 0 ? 0 : previousEnd + gap;

		const times = new Array<number>(stroke.points.length);
		times[0] = begin;
		for (let point = 1; point < times.length; point += 1) {
			const step = untimed
				? UNTIMED_STEP_MS
				: Math.min(MAX_STILL_MS, stroke.times[point]! - stroke.times[point - 1]!);
			times[point] = times[point - 1]! + step;
		}

		previousEnd = times.at(-1)!;
		return { stroke, times };
	});

	return { duration: entries.length > 0 ? previousEnd : 0, strokes: entries };
};

export type DrawnAt = {
	/** How many strokes are complete. */
	finished: number;
	/** The stroke being drawn and how many of its points are down, if any. */
	current: { index: number; points: number } | null;
};

/** What the canvas holds at a moment of the replay. */
export const drawnAt = (timeline: Timeline, at: number): DrawnAt => {
	let finished = 0;
	for (const { times } of timeline.strokes) {
		if (times.at(-1)! > at) break;
		finished += 1;
	}

	const next = timeline.strokes[finished];
	if (!next || next.times[0]! > at) return { current: null, finished };

	let points = 0;
	while (points < next.times.length && next.times[points]! <= at) points += 1;
	return { current: { index: finished, points }, finished };
};
