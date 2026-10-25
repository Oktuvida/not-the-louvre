import {
	DEFAULT_DRAWING_DOCUMENT_LIMITS,
	getRenderableDrawingStrokes,
	type DrawingDocument,
	type DrawingDocumentLimits
} from './document';

/*
 * The studio's ink: how much of what the server accepts a drawing has used.
 * The server refuses a document past any of its limits, and before the meter
 * the studio checked none of them, so twenty minutes of drawing could be lost
 * at publish. The tightest limit is the ink left.
 */

/** Below this the meter stays out of sight: nobody drawing normally ever sees it. */
export const INK_SHOWN_LEVEL = 0.75;

/** From here the meter warns that the ink is running low. */
export const INK_WARNING_LEVEL = 0.8;

// The size estimate is exact for the serializer's layout; the margin covers
// what it does not see (a longer colour, a key order change).
const BYTES_MARGIN = 0.98;
// The widest point the serializer writes, `[767,767],`.
const BYTES_PER_POINT = 10;
const DOCUMENT_BYTES =
	'{"version":2,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","base":[],"tail":[]}'
		.length;

const digits = (value: number) => String(value).length;

export type InkLevel = {
	/** 0 for a blank page, 1 when the next point would be refused. */
	used: number;
	remainingPoints: number;
	remainingStrokes: number;
};

export type InkLimits = Pick<
	DrawingDocumentLimits,
	'maxDecompressedBytes' | 'maxPointsPerStroke' | 'maxStrokes' | 'maxTotalPoints'
>;

export const measureInk = (document: DrawingDocument, limits: InkLimits = {}): InkLevel => {
	const { maxDecompressedBytes, maxStrokes, maxTotalPoints } = {
		...DEFAULT_DRAWING_DOCUMENT_LIMITS,
		...limits
	};
	const maxBytes = maxDecompressedBytes * BYTES_MARGIN;
	const strokes = getRenderableDrawingStrokes(document);

	let points = 0;
	let bytes = DOCUMENT_BYTES;
	for (const stroke of strokes) {
		// {"color":"#rrggbb","points":[…],"size":n} and the comma after it
		bytes += 39 + digits(stroke.size);
		for (const [x, y] of stroke.points) bytes += 4 + digits(x) + digits(y);
		points += stroke.points.length;
	}

	return {
		remainingPoints: Math.max(
			0,
			Math.min(maxTotalPoints - points, Math.floor((maxBytes - bytes) / BYTES_PER_POINT))
		),
		remainingStrokes: Math.max(0, maxStrokes - strokes.length),
		used: Math.min(
			1,
			Math.max(
				points / maxTotalPoints,
				strokes.length / maxStrokes,
				// The document's own frame is not ink: a blank page has used none.
				(bytes - DOCUMENT_BYTES) / (maxBytes - DOCUMENT_BYTES)
			)
		)
	};
};
