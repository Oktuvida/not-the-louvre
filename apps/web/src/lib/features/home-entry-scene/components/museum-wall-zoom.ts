export type WallZoomElements = {
	frameVisualElement: HTMLElement;
	overlayElement: HTMLElement;
	wallSceneElement: HTMLElement;
	wallTextureElement: HTMLElement;
};

export type WallZoomGeometry = {
	finalScale: number;
	translateX: number;
	translateY: number;
};

export const WALL_ZOOM_IN_DURATION_MS = 2080;
export const WALL_ZOOM_OUT_DURATION_MS = 1130;

/*
 * A 14x full-viewport zoom is the canonical vestibular trigger, and the Web
 * Animations API ignores `@media (prefers-reduced-motion: reduce)` — a CSS
 * backstop cannot neutralize it. So the whole choreography is scaled down to a
 * one-millisecond cut that lands on exactly the same end state. The scale is
 * applied to the delays as well as the durations: leaving the internal
 * texture/frame fades on their original 1520ms/1990ms offsets would fade the
 * wall out a second and a half after the state machine had already moved on.
 */
export const WALL_ZOOM_REDUCED_MOTION_DURATION_MS = 1;

export type WallZoomOptions = { reducedMotion?: boolean };

const timingScale = (reducedMotion: boolean, fullDurationMs: number) =>
	reducedMotion ? WALL_ZOOM_REDUCED_MOTION_DURATION_MS / fullDurationMs : 1;

/*
 * The zoom runs through the Web Animations API instead of a JS-driven tween so
 * the compositor keeps animating transform/opacity even while the main thread
 * is busy (Three.js camera tween, auth overlay mount). Easings are the
 * cubic-bezier equivalents of the GSAP eases used previously.
 */
const EASE_IN_QUINT = 'cubic-bezier(0.64, 0, 0.78, 0)'; // gsap power4.in
const EASE_IN_QUART = 'cubic-bezier(0.5, 0, 0.75, 0)'; // gsap power3.in
const EASE_OUT_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)'; // gsap power3.out
const EASE_OUT_CUBIC = 'cubic-bezier(0.33, 1, 0.68, 1)'; // gsap power2.out
const EASE_IN_CUBIC = 'cubic-bezier(0.32, 0, 0.67, 0)'; // gsap power2.in
const EASE_OUT_QUAD = 'cubic-bezier(0.5, 1, 0.89, 1)'; // gsap power1.out

const allElements = (elements: WallZoomElements) => [
	elements.overlayElement,
	elements.wallSceneElement,
	elements.wallTextureElement,
	elements.frameVisualElement
];

const wallTransform = ({ finalScale, translateX, translateY }: WallZoomGeometry) =>
	`translate(${translateX}px, ${translateY}px) scale(${finalScale})`;

const IDENTITY_TRANSFORM = 'translate(0px, 0px) scale(1)';

const cancelWallZoom = (elements: WallZoomElements) => {
	for (const element of allElements(elements)) {
		for (const animation of element.getAnimations()) {
			animation.cancel();
		}
	}
};

export const resetWallZoom = (elements: WallZoomElements) => {
	cancelWallZoom(elements);

	for (const element of allElements(elements)) {
		element.style.removeProperty('opacity');
		element.style.removeProperty('transform');
	}
};

export const playWallZoomIn = (
	elements: WallZoomElements,
	geometry: WallZoomGeometry,
	{ reducedMotion = false }: WallZoomOptions = {}
) => {
	cancelWallZoom(elements);
	elements.overlayElement.style.opacity = '1';

	const scale = timingScale(reducedMotion, WALL_ZOOM_IN_DURATION_MS);

	elements.wallTextureElement.animate([{ opacity: 1 }, { opacity: 0 }], {
		delay: 1520 * scale,
		duration: 260 * scale,
		easing: EASE_IN_QUART,
		fill: 'both'
	});
	elements.frameVisualElement.animate([{ opacity: 1 }, { opacity: 0 }], {
		delay: 1990 * scale,
		duration: 100 * scale,
		easing: EASE_IN_QUINT,
		fill: 'both'
	});

	return elements.wallSceneElement.animate(
		[{ transform: IDENTITY_TRANSFORM }, { transform: wallTransform(geometry) }],
		{
			duration: WALL_ZOOM_IN_DURATION_MS * scale,
			easing: EASE_IN_QUINT,
			fill: 'forwards'
		}
	);
};

export const playWallZoomOut = (
	elements: WallZoomElements,
	geometry: WallZoomGeometry,
	{ reducedMotion = false }: WallZoomOptions = {}
) => {
	cancelWallZoom(elements);

	const scale = timingScale(reducedMotion, WALL_ZOOM_OUT_DURATION_MS);

	elements.overlayElement.animate([{ opacity: 0 }, { opacity: 1 }], {
		duration: 380 * scale,
		easing: EASE_OUT_CUBIC,
		fill: 'both'
	});
	elements.frameVisualElement.animate([{ opacity: 0 }, { opacity: 1 }], {
		delay: 300 * scale,
		duration: 260 * scale,
		easing: EASE_OUT_QUAD,
		fill: 'both'
	});
	elements.wallTextureElement.animate([{ opacity: 0 }, { opacity: 1 }], {
		delay: 300 * scale,
		duration: 380 * scale,
		easing: EASE_IN_CUBIC,
		fill: 'both'
	});

	return elements.wallSceneElement.animate(
		[{ transform: wallTransform(geometry) }, { transform: IDENTITY_TRANSFORM }],
		{
			duration: WALL_ZOOM_OUT_DURATION_MS * scale,
			easing: EASE_OUT_QUART,
			fill: 'forwards'
		}
	);
};
