import {
	getDrawingPointWithinBounds,
	type DrawingDocumentV2,
	type DrawingPoint,
	type DrawingStroke
} from '#lib/features/stroke-json/document.js';

/**
 * The pointer-drawing pieces the studio canvas and the avatar sketchpad share.
 * Both surfaces keep their own state machine — one owns a bindable document, the
 * other mutates a draft in place — but the geometry, the lost-button guard, the
 * committed-stroke cache and the window release net are the same code, and used
 * to drift between the two files.
 */

/** Canvas-space point for a pointer event, clamped to the document bounds. */
export const getCanvasDrawingPoint = (
	canvas: HTMLCanvasElement,
	event: PointerEvent,
	document: DrawingDocumentV2
): DrawingPoint | null => {
	const rect = canvas.getBoundingClientRect();
	const scaleX = canvas.width / rect.width;
	const scaleY = canvas.height / rect.height;

	return getDrawingPointWithinBounds(
		[(event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY],
		document
	);
};

/**
 * True when a move arrives with the primary button no longer held. A mouse
 * released outside the window never delivers a pointerup to the page, so this is
 * the only evidence the stroke is over; the caller commits it rather than
 * dropping it. Narrowed to mice on purpose — a stylus can momentarily report
 * `buttons: 0` mid-stroke and would otherwise truncate the line.
 */
export const hasLostPrimaryButton = (event: PointerEvent) =>
	event.pointerType === 'mouse' && (event.buttons & 1) === 0;

/** Offscreen canvas holding the committed strokes, created and resized on demand. */
export const ensureCommittedCacheCanvas = (
	cache: HTMLCanvasElement | null,
	width: number,
	height: number
) => {
	const canvas = cache ?? window.document.createElement('canvas');

	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}

	return canvas;
};

/**
 * Window-level net for the pointerup/pointercancel/blur a canvas never sees
 * (pointer capture lost, a browser gesture stealing the sequence, the tab losing
 * focus mid-stroke). Returns its own cleanup.
 */
export const attachPointerReleaseSafetyNet = (onRelease: (event?: PointerEvent) => void) => {
	const handlePointerRelease = (event: PointerEvent) => {
		onRelease(event);
	};
	const handleBlur = () => {
		onRelease();
	};

	window.addEventListener('pointerup', handlePointerRelease);
	window.addEventListener('pointercancel', handlePointerRelease);
	window.addEventListener('blur', handleBlur);

	return () => {
		window.removeEventListener('pointerup', handlePointerRelease);
		window.removeEventListener('pointercancel', handlePointerRelease);
		window.removeEventListener('blur', handleBlur);
	};
};

/**
 * Everything a repaint depends on. Pointer handlers paint synchronously so the
 * ink lands in the same frame as the input; the reactive effect that also owns
 * repainting compares signatures and skips the duplicate paint instead of
 * drawing every point twice.
 */
export type DrawingRenderSignature = {
	activeStroke: DrawingStroke | null;
	activeStrokePointCount: number;
	document: DrawingDocumentV2;
	lastStrokePointCount: number;
	responsive: boolean;
	strokeCount: number;
	target: HTMLCanvasElement | null;
};

export const readDrawingRenderSignature = (input: {
	activeStroke: DrawingStroke | null;
	document: DrawingDocumentV2;
	responsive: boolean;
	target: HTMLCanvasElement | null;
}): DrawingRenderSignature => ({
	activeStroke: input.activeStroke,
	activeStrokePointCount: input.activeStroke?.points.length ?? -1,
	document: input.document,
	lastStrokePointCount: input.document.tail.at(-1)?.points.length ?? -1,
	responsive: input.responsive,
	strokeCount: input.document.tail.length,
	target: input.target
});

export const isSameDrawingRenderSignature = (
	rendered: DrawingRenderSignature | null,
	next: DrawingRenderSignature
) =>
	rendered !== null &&
	rendered.target === next.target &&
	rendered.document === next.document &&
	rendered.activeStroke === next.activeStroke &&
	rendered.activeStrokePointCount === next.activeStrokePointCount &&
	rendered.lastStrokePointCount === next.lastStrokePointCount &&
	rendered.responsive === next.responsive &&
	rendered.strokeCount === next.strokeCount;
