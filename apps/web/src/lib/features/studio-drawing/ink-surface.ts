import { renderDrawingStroke } from '#lib/features/stroke-json/canvas.js';
import {
	getRenderableDrawingStrokes,
	type DrawingDocumentV2,
	type DrawingPoint,
	type DrawingStroke
} from '#lib/features/stroke-json/document.js';

/*
 * The pixels of the studio canvas, kept apart from the document.
 *
 * - The dry layer is an offscreen bitmap with every finished stroke on it. A
 *   new stroke is laid on top when it is finished; the whole document is only
 *   painted again when it changes from outside (opening a drawing, clearing,
 *   undoing) or the canvas changes size.
 * - The wet stroke is the one under the pen. Each frame copies the dry layer
 *   and draws the wet stroke over it, so drawing costs one stroke a frame no
 *   matter how big the drawing is.
 * - The overlay carries what is not ink: where the pen is predicted to go
 *   next, and the brush cursor. It is cleared every frame.
 *
 * Every layer is backed at the screen's own pixel density (capped), and
 * strokes are drawn in document pixels through a transform, so the same
 * drawing is sharp on a phone and identical in what it records.
 */

/** A 2048² backing store is 16 MiB; past that, memory costs more than sharpness buys. */
export const MAX_BACKING_STORE_PIXELS = 2048;

/** Backing-store pixels for a canvas shown `cssPixels` wide. */
export const backingStoreSize = (cssPixels: number, devicePixelRatio: number) =>
	Math.max(1, Math.min(MAX_BACKING_STORE_PIXELS, Math.round(cssPixels * devicePixelRatio)));

export type InkSurface = {
	/** Sizes every layer for the canvas's CSS box and the screen's density. */
	resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void;
	/** Paints the dry layer from a whole document. */
	showDocument(document: DrawingDocumentV2): void;
	/** Lays a finished stroke onto the dry layer, on top of the rest. */
	dryStroke(stroke: DrawingStroke): void;
	/** The stroke under the pen, and the points it is predicted to reach next. */
	wet(stroke: DrawingStroke | null, predicted?: DrawingPoint[]): void;
	/** The brush cursor at a document point, or none. */
	cursor(point: DrawingPoint | null, color: string, size: number): void;
	destroy(): void;
};

type Cursor = { color: string; point: DrawingPoint; size: number };

export const createInkSurface = (
	canvas: HTMLCanvasElement,
	overlay: HTMLCanvasElement
): InkSurface => {
	const dry = document.createElement('canvas');
	let shown: DrawingDocumentV2 | null = null;
	let wetStroke: DrawingStroke | null = null;
	let predicted: DrawingPoint[] = [];
	let cursor: Cursor | null = null;
	let frame = 0;

	const contextOf = (target: HTMLCanvasElement) => target.getContext('2d');

	/** Draws in document pixels from here on. */
	const useDocumentSpace = (context: CanvasRenderingContext2D, target: HTMLCanvasElement) => {
		const width = shown?.width ?? target.width;
		const height = shown?.height ?? target.height;
		context.setTransform(target.width / width, 0, 0, target.height / height, 0, 0);
	};

	const paintDry = () => {
		const context = contextOf(dry);
		if (!context || !shown) return;

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.fillStyle = shown.background;
		context.fillRect(0, 0, dry.width, dry.height);
		useDocumentSpace(context, dry);
		for (const stroke of getRenderableDrawingStrokes(shown)) {
			renderDrawingStroke(context, stroke);
		}
	};

	const paint = () => {
		frame = 0;

		const context = contextOf(canvas);
		if (context) {
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.drawImage(dry, 0, 0);
			if (wetStroke) {
				useDocumentSpace(context, canvas);
				renderDrawingStroke(context, wetStroke);
			}
		}

		const overlayContext = contextOf(overlay);
		if (!overlayContext) return;

		overlayContext.setTransform(1, 0, 0, 1, 0, 0);
		overlayContext.clearRect(0, 0, overlay.width, overlay.height);
		useDocumentSpace(overlayContext, overlay);

		const lastPoint = wetStroke?.points.at(-1);
		if (wetStroke && lastPoint && predicted.length > 0) {
			renderDrawingStroke(overlayContext, { ...wetStroke, points: [lastPoint, ...predicted] });
		}

		if (cursor) {
			overlayContext.globalAlpha = 0.6;
			overlayContext.fillStyle = cursor.color;
			overlayContext.beginPath();
			overlayContext.arc(cursor.point[0], cursor.point[1], cursor.size / 2, 0, Math.PI * 2);
			overlayContext.fill();
			overlayContext.globalAlpha = 1;
		}
	};

	/** One paint per frame, however many samples arrive in it. */
	const schedule = () => {
		if (frame === 0) frame = requestAnimationFrame(paint);
	};

	return {
		resize(cssWidth, cssHeight, devicePixelRatio) {
			const width = backingStoreSize(cssWidth, devicePixelRatio);
			const height = backingStoreSize(cssHeight, devicePixelRatio);
			if (canvas.width === width && canvas.height === height && dry.width === width) return;

			for (const target of [canvas, overlay, dry]) {
				target.width = width;
				target.height = height;
			}
			paintDry();
			schedule();
		},
		showDocument(next) {
			shown = next;
			paintDry();
			schedule();
		},
		dryStroke(stroke) {
			const context = contextOf(dry);
			if (!context) return;

			useDocumentSpace(context, dry);
			renderDrawingStroke(context, stroke);
			schedule();
		},
		wet(stroke, nextPredicted = []) {
			wetStroke = stroke;
			predicted = nextPredicted;
			schedule();
		},
		cursor(point, color, size) {
			cursor = point ? { color, point, size } : null;
			schedule();
		},
		destroy() {
			cancelAnimationFrame(frame);
			frame = 0;
		}
	};
};
