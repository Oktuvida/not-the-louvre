import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MuseumWallOverlay from './MuseumWallOverlay.svelte';

type MockTimelineCall = {
	method: 'call' | 'to';
	params?: unknown;
	position?: unknown;
	target?: unknown;
	vars?: Record<string, unknown>;
};

type MockTimeline = {
	calls: MockTimelineCall[];
	call: ReturnType<typeof vi.fn>;
	kill: ReturnType<typeof vi.fn>;
	pause: ReturnType<typeof vi.fn>;
	restart: ReturnType<typeof vi.fn>;
	to: ReturnType<typeof vi.fn>;
};

const { gsapSet, gsapTimeline, timelineInstances } = vi.hoisted(() => {
	const timelineInstances: MockTimeline[] = [];
	const gsapSet = vi.fn();
	const gsapTimeline = vi.fn(() => {
		const timeline: MockTimeline = {
			calls: [],
			call: vi.fn((callback, params, position) => {
				timeline.calls.push({ method: 'call', params, position, target: callback });
				return timeline;
			}),
			kill: vi.fn(),
			pause: vi.fn(() => timeline),
			restart: vi.fn(() => timeline),
			to: vi.fn((target, vars, position) => {
				timeline.calls.push({ method: 'to', position, target, vars });
				return timeline;
			})
		};

		timelineInstances.push(timeline);
		return timeline;
	});

	return { gsapSet, gsapTimeline, timelineInstances };
});

vi.mock('gsap', () => ({
	gsap: {
		set: gsapSet,
		timeline: gsapTimeline
	}
}));

const reducedMotionMediaQuery = {
	addEventListener: vi.fn(),
	addListener: vi.fn(),
	dispatchEvent: vi.fn(),
	matches: true,
	media: '(prefers-reduced-motion: reduce)',
	onchange: null,
	removeEventListener: vi.fn(),
	removeListener: vi.fn()
} satisfies MediaQueryList;

describe('MuseumWallOverlay', () => {
	beforeEach(() => {
		timelineInstances.length = 0;
		gsapSet.mockClear();
		gsapTimeline.mockClear();
		vi.unstubAllGlobals();
	});

	it('keeps the full Come In timeline when reduced motion is requested', async () => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => reducedMotionMediaQuery)
		);

		const authOverlayElement = document.createElement('div');
		document.body.append(authOverlayElement);

		render(MuseumWallOverlay, {
			authOverlayElement,
			dispatch: vi.fn(),
			entryState: 'outside'
		});

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(timelineInstances).toHaveLength(2);
		expect(
			timelineInstances.some((timeline) =>
				timeline.calls.some(
					(call) =>
						call.method === 'to' && call.vars?.duration === 2.08 && call.vars?.scale !== undefined
				)
			)
		).toBe(true);

		authOverlayElement.remove();
	});
});
