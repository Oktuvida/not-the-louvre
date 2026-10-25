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
 * - The checkpoint is the dry layer as it was some strokes back. Undoing
 *   repaints from it rather than from the first stroke, so taking back a line
 *   costs the same in a five-line sketch and in a hundred-thousand-point one.
 *
 * Every layer is backed at the screen's own pixel density (capped), and
 * strokes are drawn in document pixels through a transform, so the same
 * drawing is sharp on a phone and identical in what it records.
 */

/** How many of the latest strokes can be undone without painting the whole drawing. */
export const CHEAP_UNDO_DEPTH = 30;

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
	/** `document` is the one shown plus `stroke` at the end: lays only that stroke. */
	append(document: DrawingDocumentV2, stroke: DrawingStroke): void;
	/**
	 * `document` is the one shown with strokes taken off its end (an undo):
	 * repaints from the checkpoint instead of from the first stroke.
	 */
	rewind(document: DrawingDocumentV2): void;
	/** The stroke under the pen, and the points it is predicted to reach next. */
	wet(stroke: DrawingStroke | null, predicted?: DrawingPoint[]): void;
	/** The brush cursor at a document point, or none; the eraser's is a ring. */
	cursor(point: DrawingPoint | null, color: string, size: number, ring: boolean): void;
	destroy(): void;
};

type Cursor = { color: string; point: DrawingPoint; ring: boolean; size: number };

export type InkSurfaceOptions = {
	/** The paper shown under the strokes, if not the document's background. */
	paper?: string;
	/** Paints guides over the paper, in document pixels; never part of the drawing. */
	decorate?: (context: CanvasRenderingContext2D) => void;
};

export const createInkSurface = (
	canvas: HTMLCanvasElement,
	overlay: HTMLCanvasElement,
	options: InkSurfaceOptions = {}
): InkSurface => {
	const dry = document.createElement('canvas');
	const checkpoint = document.createElement('canvas');
	let shown: DrawingDocumentV2 | null = null;
	// How many of the shown document's strokes the checkpoint holds.
	let checkpointCount = 0;
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

	const drawStrokes = (target: HTMLCanvasElement, strokes: DrawingStroke[]) => {
		const context = contextOf(target);
		if (!context) return;

		useDocumentSpace(context, target);
		for (const stroke of strokes) renderDrawingStroke(context, stroke);
	};

	/** The dry layer is the checkpoint plus every stroke drawn since it. */
	const paintDryFromCheckpoint = () => {
		const context = contextOf(dry);
		if (!context || !shown) return;

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.drawImage(checkpoint, 0, 0);
		drawStrokes(dry, getRenderableDrawingStrokes(shown).slice(checkpointCount));
	};

	/** Paints the whole drawing, leaving the checkpoint the cheap undos behind. */
	const paintDry = () => {
		const context = contextOf(checkpoint);
		if (!context || !shown) return;

		const strokes = getRenderableDrawingStrokes(shown);
		checkpointCount = Math.max(0, strokes.length - CHEAP_UNDO_DEPTH);
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.fillStyle = options.paper ?? shown.background;
		context.fillRect(0, 0, checkpoint.width, checkpoint.height);
		if (options.decorate) {
			useDocumentSpace(context, checkpoint);
			context.save();
			options.decorate(context);
			context.restore();
		}
		drawStrokes(checkpoint, strokes.slice(0, checkpointCount));
		paintDryFromCheckpoint();
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
			overlayContext.beginPath();
			overlayContext.arc(cursor.point[0], cursor.point[1], cursor.size / 2, 0, Math.PI * 2);
			if (cursor.ring) {
				// Paper on paper is invisible: the eraser shows where it will rub.
				overlayContext.strokeStyle = '#2d2420';
				overlayContext.lineWidth = 1.5;
				overlayContext.stroke();
			} else {
				overlayContext.fillStyle = cursor.color;
				overlayContext.fill();
			}
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

			for (const target of [canvas, overlay, dry, checkpoint]) {
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
		append(next, stroke) {
			shown = next;
			drawStrokes(dry, [stroke]);

			// Keep the checkpoint close behind: once the strokes past it are twice
			// the cheap depth, bake all but the latest ones into it.
			const strokes = getRenderableDrawingStrokes(next);
			if (strokes.length - checkpointCount > CHEAP_UNDO_DEPTH * 2) {
				const nextCount = strokes.length - CHEAP_UNDO_DEPTH;
				drawStrokes(checkpoint, strokes.slice(checkpointCount, nextCount));
				checkpointCount = nextCount;
			}
			schedule();
		},
		rewind(next) {
			shown = next;
			if (getRenderableDrawingStrokes(next).length < checkpointCount) paintDry();
			else paintDryFromCheckpoint();
			schedule();
		},
		wet(stroke, nextPredicted = []) {
			wetStroke = stroke;
			predicted = nextPredicted;
			schedule();
		},
		cursor(point, color, size, ring) {
			cursor = point ? { color, point, ring, size } : null;
			schedule();
		},
		destroy() {
			cancelAnimationFrame(frame);
			frame = 0;
		}
	};
};
