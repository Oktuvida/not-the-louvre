import { describe, expect, it } from 'vitest';
import { planVideo, VIDEO_FPS } from './video-plan';

const SECOND = 1000;
const HOLD_FRAMES = 2 * VIDEO_FPS;

describe('how a replay fits in a video', () => {
	it('plays a short drawing at the pace it was drawn, and rests on the finished piece', () => {
		const plan = planVideo(3 * SECOND);

		expect(plan.frames).toBe(3 * VIDEO_FPS + HOLD_FRAMES);
		expect(plan.momentOf(0)).toBe(0);
		expect(plan.momentOf(VIDEO_FPS)).toBeCloseTo(SECOND, -2);
	});

	it('speeds a long drawing up to half a minute, not to a blur of the whole thing', () => {
		const plan = planVideo(20 * 60 * SECOND);

		expect(plan.frames).toBe(30 * VIDEO_FPS + HOLD_FRAMES);
		expect(plan.momentOf(15 * VIDEO_FPS)).toBeCloseTo(10 * 60 * SECOND, -4);
	});

	it('reaches the finished piece and stays on it to the last frame', () => {
		const duration = 7 * SECOND;
		const plan = planVideo(duration);

		expect(plan.momentOf(plan.frames - HOLD_FRAMES - 1)).toBe(duration);
		expect(plan.momentOf(plan.frames - 1)).toBe(duration);
	});

	it('has only the rest for a drawing with no length, such as a fork with no strokes', () => {
		const plan = planVideo(0);

		expect(plan.frames).toBe(HOLD_FRAMES + 1);
		expect(plan.momentOf(plan.frames - 1)).toBe(0);
	});
});
