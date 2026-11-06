import type { InkSurface } from '#lib/features/studio-drawing/ink-surface.js';
import {
	DRAWING_DOCUMENT_V2_VERSION,
	type DrawingDocumentV2,
	type DrawingStroke
} from '#lib/features/stroke-json/document.js';
import type { InkDocument, InkStroke } from '#lib/stroke/v3.js';
import { buildTimeline, drawnAt } from './timeline';

const partOf = (stroke: InkStroke, points: number): DrawingStroke => ({
	...stroke,
	points: stroke.points.slice(0, points),
	...(stroke.pressures ? { pressures: stroke.pressures.slice(0, points) } : {}),
	times: stroke.times.slice(0, points)
});

/*
 * A drawing shown on an ink surface as it stood at any moment of its replay.
 * Finished strokes go onto the surface's dry layer one at a time as the replay
 * passes them, and the stroke being drawn is its wet stroke, so a frame costs
 * one stroke however big the drawing. Going back repaints up to that moment.
 * The player and the video both draw through this, so they cannot differ.
 */
export const createReplay = (drawing: InkDocument) => {
	const { strokes } = drawing;
	const timeline = buildTimeline(strokes);

	// The strokes on the dry layer: the document's tail grows and shrinks in
	// place, so passing a stroke costs one push, not a copy of the drawing.
	const shownStrokes: DrawingStroke[] = [];
	const shown: DrawingDocumentV2 = {
		background: drawing.background,
		base: [],
		height: drawing.height,
		kind: drawing.kind,
		tail: shownStrokes,
		version: DRAWING_DOCUMENT_V2_VERSION,
		width: drawing.width
	};

	const showMoment = (target: InkSurface, moment: number) => {
		const drawn = drawnAt(timeline, moment);

		if (drawn.finished < shownStrokes.length) {
			shownStrokes.length = drawn.finished;
			target.showDocument(shown);
		}
		while (shownStrokes.length < drawn.finished) {
			const stroke = strokes[shownStrokes.length]!;
			shownStrokes.push(stroke);
			target.append(shown, stroke);
		}

		target.wet(drawn.current ? partOf(strokes[drawn.current.index]!, drawn.current.points) : null);
	};

	return { shown, showMoment, timeline };
};
