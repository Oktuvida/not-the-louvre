import { afterEach, describe, expect, it } from 'vitest';
import {
	WALL_ZOOM_IN_DURATION_MS,
	WALL_ZOOM_OUT_DURATION_MS,
	WALL_ZOOM_REDUCED_MOTION_DURATION_MS,
	playWallZoomIn,
	playWallZoomOut,
	resetWallZoom,
	type WallZoomElements
} from './museum-wall-zoom';

const STRUCTURAL_KEYFRAME_KEYS = ['offset', 'computedOffset', 'easing', 'composite'];

const geometry = { finalScale: 18, translateX: -120, translateY: 64 };

const createElements = (): WallZoomElements => {
	const overlayElement = document.createElement('div');
	const wallSceneElement = document.createElement('div');
	const wallTextureElement = document.createElement('div');
	const frameVisualElement = document.createElement('div');

	wallSceneElement.append(wallTextureElement, frameVisualElement);
	overlayElement.append(wallSceneElement);
	document.body.append(overlayElement);

	return { frameVisualElement, overlayElement, wallSceneElement, wallTextureElement };
};

const animatedProperties = (animation: Animation) => {
	const effect = animation.effect as KeyframeEffect;

	return effect
		.getKeyframes()
		.flatMap((keyframe) =>
			Object.keys(keyframe).filter((key) => !STRUCTURAL_KEYFRAME_KEYS.includes(key))
		);
};

describe('museum-wall-zoom', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('drives the come-in zoom as a full-length compositor animation', () => {
		const elements = createElements();

		const zoom = playWallZoomIn(elements, geometry);

		expect(zoom.effect?.getTiming().duration).toBe(WALL_ZOOM_IN_DURATION_MS);
		expect((zoom.effect as KeyframeEffect).target).toBe(elements.wallSceneElement);
		expect(animatedProperties(zoom)).toEqual(['transform', 'transform']);
	});

	it('keeps every come-in track limited to transform and opacity', () => {
		const elements = createElements();

		playWallZoomIn(elements, geometry);

		const animations = elements.overlayElement.getAnimations({ subtree: true });

		expect(animations.length).toBeGreaterThan(1);
		for (const animation of animations) {
			for (const property of animatedProperties(animation)) {
				expect(['opacity', 'transform']).toContain(property);
			}
		}
	});

	it('drives the close reset back to the wall as a compositor animation', () => {
		const elements = createElements();

		playWallZoomIn(elements, geometry);
		const reset = playWallZoomOut(elements, geometry);

		expect(reset.effect?.getTiming().duration).toBe(WALL_ZOOM_OUT_DURATION_MS);

		const keyframes = (reset.effect as KeyframeEffect).getKeyframes();
		expect(keyframes.at(-1)?.transform).toBe('translate(0px, 0px) scale(1)');
	});

	it('replaces the previous zoom instead of stacking animations', () => {
		const elements = createElements();

		const first = playWallZoomIn(elements, geometry);
		playWallZoomOut(elements, geometry);

		expect(first.playState).toBe('idle');
		expect(elements.wallSceneElement.getAnimations()).toHaveLength(1);
	});

	it('collapses the come-in choreography to an instant cut under reduced motion', () => {
		const elements = createElements();

		const zoom = playWallZoomIn(elements, geometry, { reducedMotion: true });

		expect(zoom.effect?.getTiming().duration).toBe(WALL_ZOOM_REDUCED_MOTION_DURATION_MS);
		expect((zoom.effect as KeyframeEffect).getKeyframes().at(-1)?.transform).toBe(
			'translate(-120px, 64px) scale(18)'
		);

		// The internal texture/frame fades must be scaled too: left on their
		// original 1520ms/1990ms delays they would fade the wall out long after
		// the state machine had moved on.
		for (const animation of elements.overlayElement.getAnimations({ subtree: true })) {
			const timing = animation.effect!.getTiming();
			expect(Number(timing.delay) + Number(timing.duration)).toBeLessThanOrEqual(
				WALL_ZOOM_REDUCED_MOTION_DURATION_MS * 2
			);
		}
	});

	it('collapses the close under reduced motion and still lands on the wall', () => {
		const elements = createElements();

		const reset = playWallZoomOut(elements, geometry, { reducedMotion: true });

		expect(reset.effect?.getTiming().duration).toBe(WALL_ZOOM_REDUCED_MOTION_DURATION_MS);
		expect((reset.effect as KeyframeEffect).getKeyframes().at(-1)?.transform).toBe(
			'translate(0px, 0px) scale(1)'
		);
	});

	it('resetWallZoom cancels animations and clears inline styles', () => {
		const elements = createElements();

		const zoom = playWallZoomIn(elements, geometry);
		resetWallZoom(elements);

		expect(zoom.playState).toBe('idle');
		expect(elements.overlayElement.getAnimations({ subtree: true })).toHaveLength(0);
		for (const element of Object.values(elements)) {
			expect(element.style.opacity).toBe('');
			expect(element.style.transform).toBe('');
		}
	});
});
