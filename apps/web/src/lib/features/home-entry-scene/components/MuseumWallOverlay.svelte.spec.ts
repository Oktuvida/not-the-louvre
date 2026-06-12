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

const { gsapSet, gsapTimeline, gsapTo, timelineInstances } = vi.hoisted(() => {
	const timelineInstances: MockTimeline[] = [];
	const gsapSet = vi.fn();
	const gsapTo = vi.fn();
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

	return { gsapSet, gsapTimeline, gsapTo, timelineInstances };
});

vi.mock('$lib/client/gsap', () => {
	const gsap = {
		set: gsapSet,
		timeline: gsapTimeline,
		to: gsapTo
	};

	return {
		default: gsap,
		gsap
	};
});

const STRUCTURAL_KEYFRAME_KEYS = ['offset', 'computedOffset', 'easing', 'composite'];

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
		gsapTo.mockClear();
		vi.unstubAllGlobals();
	});

	it('seeds wall slabs with centered opening geometry before layout measurement runs', () => {
		const authOverlayElement = document.createElement('div');
		document.body.append(authOverlayElement);

		render(MuseumWallOverlay, {
			authOverlayElement,
			dispatch: vi.fn(),
			entryState: 'outside'
		});

		const leftSlab = document.querySelector('[data-testid="museum-wall-slab-left"]');
		const rightSlab = document.querySelector('[data-testid="museum-wall-slab-right"]');

		expect(leftSlab?.getAttribute('style')).toContain(
			'calc(50% - (0.444444 * clamp(19rem, 80vw, 49rem)) + (0.163889 * clamp(19rem, 80vw, 49rem)))'
		);
		expect(leftSlab?.getAttribute('style')).toContain(
			'calc(50% - (0.5 * clamp(19rem, 80vw, 49rem)) + (0.180556 * clamp(19rem, 80vw, 49rem)))'
		);
		expect(rightSlab?.getAttribute('style')).toContain(
			'calc(50% - (0.444444 * clamp(19rem, 80vw, 49rem)) + (0.740278 * clamp(19rem, 80vw, 49rem)))'
		);
		expect(rightSlab?.getAttribute('style')).toContain(
			'calc(50% - (0.5 * clamp(19rem, 80vw, 49rem)) + (0.819444 * clamp(19rem, 80vw, 49rem)))'
		);

		authOverlayElement.remove();
	});

	it('swaps wall texture and logo to bitmaps after mount so zooming never re-rasterizes svg', async () => {
		const authOverlayElement = document.createElement('div');
		document.body.append(authOverlayElement);

		render(MuseumWallOverlay, {
			authOverlayElement,
			dispatch: vi.fn(),
			entryState: 'outside'
		});

		const leftSlab = document.querySelector('[data-testid="museum-wall-slab-left"]');

		await expect
			.poll(() => leftSlab?.getAttribute('style'), { timeout: 5000 })
			.toMatch(/background-image:\s*url\(["']?blob:/);

		const logoImage = document.querySelector('[data-testid="museum-wall-logo"]');

		await expect.poll(() => logoImage?.getAttribute('src'), { timeout: 5000 }).toMatch(/^blob:/);

		authOverlayElement.remove();
	});

	it('runs the come-in zoom on the compositor using only transform and opacity tracks', async () => {
		const authOverlayElement = document.createElement('div');
		document.body.append(authOverlayElement);

		const { rerender } = render(MuseumWallOverlay, {
			authOverlayElement,
			dispatch: vi.fn(),
			entryState: 'outside'
		});

		await rerender({ entryState: 'transitioning-in' });

		const wallScene = document.querySelector('[data-testid="museum-wall-scene"]') as HTMLElement;
		const zoomAnimations = wallScene.getAnimations();

		expect(zoomAnimations).toHaveLength(1);
		expect(zoomAnimations[0].effect?.getTiming().duration).toBe(2080);

		const overlayRoot = wallScene.parentElement as HTMLElement;
		const subtreeAnimations = overlayRoot.getAnimations({ subtree: true });

		expect(subtreeAnimations.length).toBeGreaterThan(1);
		for (const animation of subtreeAnimations) {
			const keyframes = (animation.effect as KeyframeEffect).getKeyframes();
			for (const keyframe of keyframes) {
				const properties = Object.keys(keyframe).filter(
					(key) => !STRUCTURAL_KEYFRAME_KEYS.includes(key)
				);
				for (const property of properties) {
					expect(['opacity', 'transform']).toContain(property);
				}
			}
		}

		authOverlayElement.remove();
	});

	it('keeps the full Come In zoom when reduced motion is requested', async () => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => reducedMotionMediaQuery)
		);

		const authOverlayElement = document.createElement('div');
		document.body.append(authOverlayElement);

		const { rerender } = render(MuseumWallOverlay, {
			authOverlayElement,
			dispatch: vi.fn(),
			entryState: 'outside'
		});

		await rerender({ entryState: 'transitioning-in' });

		const wallScene = document.querySelector('[data-testid="museum-wall-scene"]') as HTMLElement;
		const zoomAnimations = wallScene.getAnimations();

		expect(zoomAnimations).toHaveLength(1);
		expect(zoomAnimations[0].effect?.getTiming().duration).toBe(2080);

		authOverlayElement.remove();
	});
});
