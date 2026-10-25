import {
	getDrawingPointWithinBounds,
	type DrawingDocumentV2,
	type DrawingPoint
} from '#lib/features/stroke-json/document.js';

/**
 * The pointer pieces of the drawing canvas the studio and the avatar pad
 * share: where a pointer lands in the document, the lost-button guard and the
 * window release net.
 */

/**
 * Document point for a client position on a canvas laid out at `rect`, or null
 * outside the document. The canvas's own pixel count plays no part: it follows
 * the screen's density, while the document is always the same size.
 */
export const getDrawingPointInRect = (
	rect: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>,
	position: { clientX: number; clientY: number },
	document: Pick<DrawingDocumentV2, 'height' | 'width'>
): DrawingPoint | null =>
	getDrawingPointWithinBounds(
		[
			((position.clientX - rect.left) * document.width) / rect.width,
			((position.clientY - rect.top) * document.height) / rect.height
		],
		document
	);

/**
 * The box a canvas paints into: its border box less the border, so a point on
 * the drawing's edge is the document's edge, not a pixel short of it.
 */
export const getCanvasContentRect = (canvas: HTMLCanvasElement) => {
	const rect = canvas.getBoundingClientRect();
	const borderX = canvas.offsetWidth - canvas.clientWidth;
	const borderY = canvas.offsetHeight - canvas.clientHeight;

	return {
		height: rect.height - borderY,
		left: rect.left + canvas.clientLeft,
		top: rect.top + canvas.clientTop,
		width: rect.width - borderX
	};
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
