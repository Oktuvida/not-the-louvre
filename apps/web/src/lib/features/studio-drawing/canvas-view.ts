/*
 * Zoom and pan for the studio canvas. The frame stays put; the view inside it
 * is moved and scaled with a CSS transform, so pointer mapping (which reads
 * the canvas's box on screen) stays right at any zoom.
 */

export type CanvasView = { scale: number; x: number; y: number };

export const FIT_VIEW: CanvasView = { scale: 1, x: 0, y: 0 };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
// A pinch may overshoot the fit while the fingers are down; it snaps back after.
const MIN_PINCH_ZOOM = 0.5;

type Point = { x: number; y: number };

/** Keeps a zoomed-in canvas covering the frame: no paper-less gaps at the edges. */
export const clampView = (view: CanvasView, frame: { height: number; width: number }) => {
	if (view.scale < MIN_ZOOM) return view;

	return {
		scale: view.scale,
		x: Math.min(0, Math.max(frame.width - frame.width * view.scale, view.x)),
		y: Math.min(0, Math.max(frame.height - frame.height * view.scale, view.y))
	};
};

/**
 * The view that keeps the canvas point under `anchor` (frame coordinates)
 * under it while the zoom becomes `scale`.
 */
const scaleAround = (view: CanvasView, anchor: Point, scale: number): CanvasView => {
	const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_PINCH_ZOOM, scale));
	const canvasX = (anchor.x - view.x) / view.scale;
	const canvasY = (anchor.y - view.y) / view.scale;

	return { scale: nextScale, x: anchor.x - canvasX * nextScale, y: anchor.y - canvasY * nextScale };
};

export const zoomAround = (
	view: CanvasView,
	anchor: Point,
	scale: number,
	frame: { height: number; width: number }
): CanvasView => clampView(scaleAround(view, anchor, scale), frame);

/** Where two fingers started and the view they started from. */
export type PinchStart = { distance: number; midpoint: Point; view: CanvasView };

export const startPinch = (fingers: Point[], view: CanvasView): PinchStart => ({
	distance: Math.max(1, Math.hypot(fingers[1]!.x - fingers[0]!.x, fingers[1]!.y - fingers[0]!.y)),
	midpoint: { x: (fingers[0]!.x + fingers[1]!.x) / 2, y: (fingers[0]!.y + fingers[1]!.y) / 2 },
	view
});

/** Spreading zooms around the fingers; moving them together pans. */
export const pinchView = (
	start: PinchStart,
	fingers: Point[],
	frame: { height: number; width: number }
): CanvasView => {
	const distance = Math.hypot(fingers[1]!.x - fingers[0]!.x, fingers[1]!.y - fingers[0]!.y);
	const midpoint = {
		x: (fingers[0]!.x + fingers[1]!.x) / 2,
		y: (fingers[0]!.y + fingers[1]!.y) / 2
	};
	const zoomed = scaleAround(
		start.view,
		start.midpoint,
		start.view.scale * (distance / start.distance)
	);

	return clampView(
		{
			scale: zoomed.scale,
			x: zoomed.x + midpoint.x - start.midpoint.x,
			y: zoomed.y + midpoint.y - start.midpoint.y
		},
		frame
	);
};

/** Once the fingers lift, a view zoomed out past the fit fills the frame again. */
export const settleView = (view: CanvasView) => (view.scale < MIN_ZOOM * 1.02 ? FIT_VIEW : view);
