import {
	decodeDrawingV3,
	type InkDocument,
	type InkStroke,
	type ParentReference
} from '../../stroke/v3';
import {
	DRAWING_DOCUMENT_V2_VERSION,
	cloneDrawingStroke,
	getRenderableDrawingStrokes,
	parseEditableDrawingDocumentV2,
	type DrawingDocument,
	type DrawingDocumentV2,
	type DrawingStroke
} from './document';

/*
 * The studio's drawing and the v3 document it is published as. The studio
 * keeps its v2-shaped document (drafts, undo and the canvas all work on it),
 * with each stroke carrying what v3 records; a stroke from before v3 gets the
 * plain round brush and no timing, which is how it was drawn.
 */

const toInkStroke = (stroke: DrawingStroke): InkStroke => ({
	brush: stroke.brush ?? 'round@1',
	color: stroke.color,
	pointer: stroke.pointer ?? 'mouse',
	points: stroke.points.map(([x, y]) => [x, y]),
	...(stroke.pressures ? { pressures: [...stroke.pressures] } : {}),
	size: stroke.size,
	start: stroke.start ?? 0,
	times: stroke.times ? [...stroke.times] : stroke.points.map(() => 0)
});

export const toInkDocument = (
	document: DrawingDocument,
	parent?: ParentReference
): InkDocument => ({
	background: document.background,
	height: document.height,
	kind: document.kind,
	...(parent ? { parent } : {}),
	strokes: getRenderableDrawingStrokes(document).map(toInkStroke),
	width: document.width
});

/** A stored v3 drawing as the studio edits it: every stroke its own. */
export const fromInkDocument = (document: InkDocument): DrawingDocumentV2 => ({
	background: document.background,
	base: [],
	height: document.height,
	kind: document.kind,
	tail: document.strokes.map((stroke) => cloneDrawingStroke(stroke)),
	version: DRAWING_DOCUMENT_V2_VERSION,
	width: document.width
});

/** Any drawing the app sends or stores (v1, v2 or v3) as the studio edits it. */
export const parseEditableDrawing = (json: string): DrawingDocumentV2 => {
	const value: unknown = JSON.parse(json);
	return typeof value === 'object' && value !== null && 'version' in value && value.version === 3
		? fromInkDocument(decodeDrawingV3(value))
		: parseEditableDrawingDocumentV2(json);
};
