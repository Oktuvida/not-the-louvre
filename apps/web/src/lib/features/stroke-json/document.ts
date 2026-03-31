import { z } from 'zod';

export const ARTWORK_DRAWING_DIMENSIONS = {
	background: '#fdfbf7',
	height: 768,
	width: 768
} as const;

export const AVATAR_DRAWING_DIMENSIONS = {
	background: '#f5f0e1',
	height: 340,
	width: 340
} as const;

export const DRAWING_DOCUMENT_VERSION = 1 as const;

export const drawingColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const drawingPointSchema = z.tuple([
	z.number().int().nonnegative(),
	z.number().int().nonnegative()
]);

const drawingStrokeSchema = z.object({
	color: drawingColorSchema,
	points: z.array(drawingPointSchema),
	size: z.number().int().min(1).max(64)
});

const createKindSchema = (
	kind: 'artwork' | 'avatar',
	dimensions: { background: string; height: number; width: number }
) =>
	z.object({
		background: z.literal(dimensions.background),
		height: z.literal(dimensions.height),
		kind: z.literal(kind),
		strokes: z.array(drawingStrokeSchema),
		version: z.literal(DRAWING_DOCUMENT_VERSION),
		width: z.literal(dimensions.width)
	});

const baseDrawingDocumentSchema = z.discriminatedUnion('kind', [
	createKindSchema('artwork', ARTWORK_DRAWING_DIMENSIONS),
	createKindSchema('avatar', AVATAR_DRAWING_DIMENSIONS)
]);

export const DrawingDocumentSchema = baseDrawingDocumentSchema.superRefine((document, context) => {
	for (const [strokeIndex, stroke] of document.strokes.entries()) {
		if (stroke.points.length === 0) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Each stroke must contain at least one point',
				path: ['strokes', strokeIndex, 'points']
			});
		}

		for (const [pointIndex, [x, y]] of stroke.points.entries()) {
			if (x > document.width) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Point x coordinate must be within canvas width ${document.width}`,
					path: ['strokes', strokeIndex, 'points', pointIndex, 0]
				});
			}

			if (y > document.height) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Point y coordinate must be within canvas height ${document.height}`,
					path: ['strokes', strokeIndex, 'points', pointIndex, 1]
				});
			}
		}
	}
});

export type DrawingDocumentV1 = z.infer<typeof DrawingDocumentSchema>;
export type DrawingKind = DrawingDocumentV1['kind'];
export type DrawingStroke = DrawingDocumentV1['strokes'][number];
export type DrawingPoint = DrawingStroke['points'][number];

export const clampDrawingPoint = (
	point: [number, number],
	dimensions: Pick<DrawingDocumentV1, 'height' | 'width'>
): DrawingPoint => [
	Math.max(0, Math.min(dimensions.width, Math.round(point[0]))),
	Math.max(0, Math.min(dimensions.height, Math.round(point[1])))
];

export const getDrawingPointWithinBounds = (
	point: [number, number],
	dimensions: Pick<DrawingDocumentV1, 'height' | 'width'>
): DrawingPoint | null => {
	if (
		point[0] < 0 ||
		point[1] < 0 ||
		point[0] > dimensions.width ||
		point[1] > dimensions.height
	) {
		return null;
	}

	return clampDrawingPoint(point, dimensions);
};

export type DrawingDocumentLimits = {
	compressedBytes?: number;
	maxCompressedBytes?: number;
	maxDecompressedBytes?: number;
	maxPointsPerStroke?: number;
	maxStrokes?: number;
	maxTotalPoints?: number;
};

export const DEFAULT_DRAWING_DOCUMENT_LIMITS: Required<
	Omit<DrawingDocumentLimits, 'compressedBytes'>
> = {
	maxCompressedBytes: 128 * 1024,
	maxDecompressedBytes: 512 * 1024,
	maxPointsPerStroke: 2000,
	maxStrokes: 2000,
	maxTotalPoints: 50_000
};

const getDimensionsForKind = (kind: DrawingKind) =>
	kind === 'artwork' ? ARTWORK_DRAWING_DIMENSIONS : AVATAR_DRAWING_DIMENSIONS;

export const createEmptyDrawingDocument = (kind: DrawingKind): DrawingDocumentV1 => {
	const dimensions = getDimensionsForKind(kind);

	return {
		background: dimensions.background,
		height: dimensions.height,
		kind,
		strokes: [],
		version: DRAWING_DOCUMENT_VERSION,
		width: dimensions.width
	};
};

export const parseDrawingDocument = (input: string): DrawingDocumentV1 => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(input);
	} catch {
		throw new Error('Invalid drawing document JSON');
	}

	return DrawingDocumentSchema.parse(parsed);
};

export const serializeDrawingDocument = (document: DrawingDocumentV1) =>
	JSON.stringify(DrawingDocumentSchema.parse(document));

export const countDrawingPoints = (document: DrawingDocumentV1) =>
	document.strokes.reduce((total, stroke) => total + stroke.points.length, 0);

export const assertDrawingDocumentWithinLimits = (
	document: DrawingDocumentV1,
	limits: DrawingDocumentLimits = DEFAULT_DRAWING_DOCUMENT_LIMITS
) => {
	const parsedDocument = DrawingDocumentSchema.parse(document);
	const mergedLimits = { ...DEFAULT_DRAWING_DOCUMENT_LIMITS, ...limits };
	const rawBytes = new TextEncoder().encode(serializeDrawingDocument(parsedDocument)).byteLength;

	if (rawBytes > mergedLimits.maxDecompressedBytes) {
		throw new Error(
			`Drawing document exceeds max decompressed bytes of ${mergedLimits.maxDecompressedBytes}`
		);
	}

	if (
		typeof limits.compressedBytes === 'number' &&
		limits.compressedBytes > mergedLimits.maxCompressedBytes
	) {
		throw new Error(
			`Drawing document exceeds max compressed bytes of ${mergedLimits.maxCompressedBytes}`
		);
	}

	if (parsedDocument.strokes.length > mergedLimits.maxStrokes) {
		throw new Error(`Drawing document exceeds max strokes of ${mergedLimits.maxStrokes}`);
	}

	const totalPoints = countDrawingPoints(parsedDocument);
	if (totalPoints > mergedLimits.maxTotalPoints) {
		throw new Error(`Drawing document exceeds max total points of ${mergedLimits.maxTotalPoints}`);
	}

	for (const stroke of parsedDocument.strokes) {
		if (stroke.points.length > mergedLimits.maxPointsPerStroke) {
			throw new Error(
				`Drawing document exceeds max points per stroke of ${mergedLimits.maxPointsPerStroke}`
			);
		}
	}

	return parsedDocument;
};
