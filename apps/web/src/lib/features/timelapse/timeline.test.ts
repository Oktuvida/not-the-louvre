import { describe, expect, it } from 'vitest';
import type { InkStroke } from '../../stroke/v3';
import { buildTimeline, drawnAt } from './timeline';

const stroke = (start: number, times: number[]): InkStroke => ({
	brush: 'round@1',
	color: '#1d3557',
	pointer: 'mouse',
	points: times.map((_, index) => [100 + index * 10, 100] as [number, number]),
	size: 6,
	start,
	times
});

describe('the timeline of a drawing', () => {
	it('replays strokes in the rhythm they were drawn in', () => {
		const timeline = buildTimeline([stroke(0, [0, 10, 20]), stroke(300, [0, 10])]);

		expect(timeline.strokes.map((entry) => entry.times)).toEqual([
			[0, 10, 20],
			[300, 310]
		]);
		expect(timeline.duration).toBe(310);
	});

	it('cuts a long break between strokes short', () => {
		// Twenty minutes for a cup of tea become under half a second.
		const timeline = buildTimeline([stroke(0, [0, 10]), stroke(20 * 60 * 1000, [0, 10])]);

		expect(timeline.strokes[1]?.times).toEqual([410, 420]);
	});

	it('cuts a pen resting mid-stroke short', () => {
		const timeline = buildTimeline([stroke(0, [0, 10, 5000, 5010])]);

		expect(timeline.strokes[0]?.times).toEqual([0, 10, 260, 270]);
	});

	it('gives a drawing without timing an even pace, in the order it was drawn', () => {
		const timeline = buildTimeline([stroke(0, [0, 0, 0]), stroke(0, [0, 0])]);
		const [first, second] = timeline.strokes;

		expect(first!.times[1]! - first!.times[0]!).toBeGreaterThan(0);
		expect(second!.times[0]!).toBeGreaterThan(first!.times.at(-1)!);
	});
});

describe('what is on the canvas at a moment of the replay', () => {
	const timeline = buildTimeline([stroke(0, [0, 10, 20]), stroke(100, [0, 10])]);

	it('holds every stroke finished by then, and the part of the one under way', () => {
		expect(drawnAt(timeline, 15)).toEqual({ finished: 0, current: { index: 0, points: 2 } });
		expect(drawnAt(timeline, 105)).toEqual({ finished: 1, current: { index: 1, points: 1 } });
	});

	it('holds the whole drawing at the end', () => {
		expect(drawnAt(timeline, timeline.duration)).toEqual({ finished: 2, current: null });
	});

	it('holds nothing before the first point', () => {
		expect(drawnAt(timeline, -1)).toEqual({ finished: 0, current: null });
	});
});
