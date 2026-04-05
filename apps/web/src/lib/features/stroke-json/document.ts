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
export const DRAWING_DOCUMENT_V2_VERSION = 2 as const;
export const LATEST_DRAWING_DOCUMENT_VERSION = DRAWING_DOCUMENT_V2_VERSION;

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

const createV1KindSchema = (
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

const createV2KindSchema = (
	kind: 'artwork' | 'avatar',
	dimensions: { background: string; height: number; width: number }
) =>
	z.object({
		background: z.literal(dimensions.background),
		base: z.array(drawingStrokeSchema),
		height: z.literal(dimensions.height),
		kind: z.literal(kind),
		tail: z.array(drawingStrokeSchema),
		version: z.literal(DRAWING_DOCUMENT_V2_VERSION),
		width: z.literal(dimensions.width)
	});

export const DrawingDocumentV1Schema = z.discriminatedUnion('kind', [
	createV1KindSchema('artwork', ARTWORK_DRAWING_DIMENSIONS),
	createV1KindSchema('avatar', AVATAR_DRAWING_DIMENSIONS)
]);

export const DrawingDocumentV2Schema = z.discriminatedUnion('kind', [
	createV2KindSchema('artwork', ARTWORK_DRAWING_DIMENSIONS),
	createV2KindSchema('avatar', AVATAR_DRAWING_DIMENSIONS)
]);

const baseDrawingDocumentSchema = z.union([DrawingDocumentV1Schema, DrawingDocumentV2Schema]);

export type DrawingDocumentV1 = z.infer<typeof DrawingDocumentV1Schema>;
export type DrawingDocumentV2 = z.infer<typeof DrawingDocumentV2Schema>;
export type DrawingDocument = DrawingDocumentV1 | DrawingDocumentV2;
export type DrawingKind = DrawingDocument['kind'];
export type DrawingStroke = z.infer<typeof drawingStrokeSchema>;
export type DrawingPoint = DrawingStroke['points'][number];

type DrawingStrokeCollection = {
	key: 'base' | 'strokes' | 'tail';
	strokes: DrawingStroke[];
};

const getStrokeCollections = (document: DrawingDocument): DrawingStrokeCollection[] =>
	document.version === DRAWING_DOCUMENT_VERSION
		? [{ key: 'strokes', strokes: document.strokes }]
		: [
				{ key: 'base', strokes: document.base },
				{ key: 'tail', strokes: document.tail }
			];

export const DrawingDocumentSchema = baseDrawingDocumentSchema.superRefine((document, context) => {
	for (const collection of getStrokeCollections(document)) {
		for (const [strokeIndex, stroke] of collection.strokes.entries()) {
			if (stroke.points.length === 0) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Each stroke must contain at least one point',
					path: [collection.key, strokeIndex, 'points']
				});
			}

			for (const [pointIndex, [x, y]] of stroke.points.entries()) {
				if (x > document.width) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Point x coordinate must be within canvas width ${document.width}`,
						path: [collection.key, strokeIndex, 'points', pointIndex, 0]
					});
				}

				if (y > document.height) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Point y coordinate must be within canvas height ${document.height}`,
						path: [collection.key, strokeIndex, 'points', pointIndex, 1]
					});
				}
			}
		}
	}
});

export const clampDrawingPoint = (
	point: [number, number],
	dimensions: Pick<DrawingDocument, 'height' | 'width'>
): DrawingPoint => [
	Math.max(0, Math.min(dimensions.width, Math.round(point[0]))),
	Math.max(0, Math.min(dimensions.height, Math.round(point[1])))
];

export const getDrawingPointWithinBounds = (
	point: [number, number],
	dimensions: Pick<DrawingDocument, 'height' | 'width'>
): DrawingPoint | null => {
	if (point[0] < 0 || point[1] < 0 || point[0] > dimensions.width || point[1] > dimensions.height) {
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
	maxPointsPerStroke: 5000,
	maxStrokes: 5000,
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

export const createEmptyDrawingDocumentV2 = (kind: DrawingKind): DrawingDocumentV2 => {
	const dimensions = getDimensionsForKind(kind);

	return {
		background: dimensions.background,
		base: [],
		height: dimensions.height,
		kind,
		tail: [],
		version: DRAWING_DOCUMENT_V2_VERSION,
		width: dimensions.width
	};
};

const cloneDrawingStroke = (stroke: DrawingStroke): DrawingStroke => ({
	color: stroke.color,
	points: stroke.points.map((point) => [point[0], point[1]] as DrawingPoint),
	size: stroke.size
});

export const cloneDrawingDocument = (document: DrawingDocumentV1): DrawingDocumentV1 => ({
	background: document.background,
	height: document.height,
	kind: document.kind,
	strokes: document.strokes.map(cloneDrawingStroke),
	version: document.version,
	width: document.width
});

export const cloneDrawingDocumentV2 = (document: DrawingDocumentV2): DrawingDocumentV2 => ({
	background: document.background,
	base: document.base.map(cloneDrawingStroke),
	height: document.height,
	kind: document.kind,
	tail: document.tail.map(cloneDrawingStroke),
	version: document.version,
	width: document.width
});

export const cloneVersionedDrawingDocument = <T extends DrawingDocument>(document: T): T =>
	(document.version === DRAWING_DOCUMENT_VERSION
		? cloneDrawingDocument(document)
		: cloneDrawingDocumentV2(document)) as T;

const parseDrawingJson = (input: string): unknown => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(input);
	} catch {
		throw new Error('Invalid drawing document JSON');
	}

	return parsed;
};

export const getRenderableDrawingStrokes = (document: DrawingDocument): DrawingStroke[] =>
	document.version === DRAWING_DOCUMENT_VERSION
		? document.strokes.map(cloneDrawingStroke)
		: [...document.base.map(cloneDrawingStroke), ...document.tail.map(cloneDrawingStroke)];

export const normalizeDrawingDocumentToV2 = (document: DrawingDocument): DrawingDocumentV2 =>
	document.version === DRAWING_DOCUMENT_V2_VERSION
		? cloneDrawingDocumentV2(document)
		: {
				background: document.background,
				base: document.strokes.map(cloneDrawingStroke),
				height: document.height,
				kind: document.kind,
				tail: [],
				version: DRAWING_DOCUMENT_V2_VERSION,
				width: document.width
			};

export const normalizeDrawingDocumentToEditableV2 = (
	document: DrawingDocument
): DrawingDocumentV2 =>
	document.version === DRAWING_DOCUMENT_V2_VERSION
		? cloneDrawingDocumentV2(document)
		: {
				background: document.background,
				base: [],
				height: document.height,
				kind: document.kind,
				tail: document.strokes.map(cloneDrawingStroke),
				version: DRAWING_DOCUMENT_V2_VERSION,
				width: document.width
			};

export const flattenDrawingDocumentToV1 = (document: DrawingDocument): DrawingDocumentV1 => ({
	background: document.background,
	height: document.height,
	kind: document.kind,
	strokes: getRenderableDrawingStrokes(document),
	version: DRAWING_DOCUMENT_VERSION,
	width: document.width
});

export const parseVersionedDrawingDocument = (input: string): DrawingDocument =>
	DrawingDocumentSchema.parse(parseDrawingJson(input));

export const parseDrawingDocument = (input: string): DrawingDocumentV1 =>
	flattenDrawingDocumentToV1(parseVersionedDrawingDocument(input));

export const parseDrawingDocumentV2 = (input: string): DrawingDocumentV2 =>
	normalizeDrawingDocumentToV2(parseVersionedDrawingDocument(input));

export const parseEditableDrawingDocumentV2 = (input: string): DrawingDocumentV2 =>
	normalizeDrawingDocumentToEditableV2(parseVersionedDrawingDocument(input));

const toSerializableStroke = (stroke: DrawingStroke) => ({
	color: stroke.color,
	size: stroke.size,
	points: stroke.points.map((point) => [point[0], point[1]])
});

const toSerializableDocumentV1 = (document: DrawingDocumentV1) => ({
	version: DRAWING_DOCUMENT_VERSION,
	kind: document.kind,
	width: document.width,
	height: document.height,
	background: document.background,
	strokes: document.strokes.map(toSerializableStroke)
});

const toSerializableDocumentV2 = (document: DrawingDocumentV2) => ({
	version: DRAWING_DOCUMENT_V2_VERSION,
	kind: document.kind,
	width: document.width,
	height: document.height,
	background: document.background,
	base: document.base.map(toSerializableStroke),
	tail: document.tail.map(toSerializableStroke)
});

export const serializeDrawingDocument = (document: DrawingDocument) => {
	const parsedDocument = DrawingDocumentSchema.parse(document);

	return JSON.stringify(
		parsedDocument.version === DRAWING_DOCUMENT_VERSION
			? toSerializableDocumentV1(parsedDocument)
			: toSerializableDocumentV2(parsedDocument)
	);
};

export const serializeCanonicalDrawingDocument = (document: DrawingDocument) =>
	JSON.stringify(
		toSerializableDocumentV2(normalizeDrawingDocumentToV2(DrawingDocumentSchema.parse(document)))
	);

export const serializeEditableDrawingDocument = (document: DrawingDocument) =>
	JSON.stringify(
		toSerializableDocumentV2(
			normalizeDrawingDocumentToEditableV2(DrawingDocumentSchema.parse(document))
		)
	);

export const countDrawingPoints = (document: DrawingDocument) =>
	getRenderableDrawingStrokes(document).reduce((total, stroke) => total + stroke.points.length, 0);

export const assertDrawingDocumentWithinLimits = <T extends DrawingDocument>(
	document: T,
	limits: DrawingDocumentLimits = DEFAULT_DRAWING_DOCUMENT_LIMITS
) => {
	const parsedDocument = DrawingDocumentSchema.parse(document) as T;
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

	if (getRenderableDrawingStrokes(parsedDocument).length > mergedLimits.maxStrokes) {
		throw new Error(`Drawing document exceeds max strokes of ${mergedLimits.maxStrokes}`);
	}

	const totalPoints = countDrawingPoints(parsedDocument);
	if (totalPoints > mergedLimits.maxTotalPoints) {
		throw new Error(`Drawing document exceeds max total points of ${mergedLimits.maxTotalPoints}`);
	}

	for (const stroke of getRenderableDrawingStrokes(parsedDocument)) {
		if (stroke.points.length > mergedLimits.maxPointsPerStroke) {
			throw new Error(
				`Drawing document exceeds max points per stroke of ${mergedLimits.maxPointsPerStroke}`
			);
		}
	}

	return parsedDocument;
};
