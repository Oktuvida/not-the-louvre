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

// The size estimate follows the v3 document's layout (stroke/v3.ts): columns
// of whole quarter pixels, milliseconds and pressure levels, each written as
// the difference from the one before. The margin covers what it does not see
// (a parent reference, a longer pointer name).
const BYTES_MARGIN = 0.98;
// A generous point: x, y, time and pressure differences with their commas.
const BYTES_PER_POINT = 16;
const DOCUMENT_BYTES =
	'{"background":"#fdfbf7","brushes":["round@1","eraser@1"],"height":768,"kind":"artwork","pressureMax":1023,"strokes":[],"version":3,"width":768,"xyScale":4}'
		.length;
const STROKE_BYTES =
	'{"brush":0,"color":"#rrggbb","pointer":"touch","size":,"start":,"t":[],"x":[],"y":[]},'.length;
const PRESSURE_COLUMN_BYTES = '"p":[],'.length;

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
		bytes += STROKE_BYTES + digits(stroke.size) + digits(Math.round(stroke.start ?? 0));
		if (stroke.pressures) bytes += PRESSURE_COLUMN_BYTES;

		let previousX = 0;
		let previousY = 0;
		let previousTime = 0;
		let previousPressure = 0;
		stroke.points.forEach(([x, y], index) => {
			const quarterX = Math.round(x * 4);
			const quarterY = Math.round(y * 4);
			const time = Math.round(stroke.times?.[index] ?? 0);
			bytes +=
				3 +
				digits(quarterX - previousX) +
				digits(quarterY - previousY) +
				digits(time - previousTime);
			previousX = quarterX;
			previousY = quarterY;
			previousTime = time;

			const pressure = stroke.pressures?.[index];
			if (pressure !== undefined) {
				const level = Math.round(pressure * 1023);
				bytes += 1 + digits(level - previousPressure);
				previousPressure = level;
			}
		});
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
