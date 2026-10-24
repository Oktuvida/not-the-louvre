/*
 * Reader for the drawing documents the Rust/WASM runtime stored (versions 1 and
 * 2), with the same rules, the same limits and the same check order, so every
 * stored drawing reads back exactly as it did before. legacy.test.ts holds the
 * reader to answers recorded from the Rust runtime itself.
 *
 * The order mirrors serde: the JSON must parse and carry an unsigned integer
 * `version` (else INVALID_JSON); then every field must have its exact type, with
 * unknown fields rejected; then dimensions, colors, sizes and points are
 * checked; then the complexity limits.
 */

export type StrokeDocumentErrorCode =
	| 'INVALID_JSON'
	| 'INVALID_DOCUMENT'
	| 'LIMITS_EXCEEDED'
	| 'DECOMPRESSION_FAILED';

export class StrokeDocumentError extends Error {
	constructor(
		readonly code: StrokeDocumentErrorCode,
		message: string
	) {
		super(message);
		this.name = 'StrokeDocumentError';
	}
}

export type DrawingKind = 'artwork' | 'avatar';
export type LegacyStroke = { color: string; size: number; points: [number, number][] };
type Header = { kind: DrawingKind; width: number; height: number; background: string };
export type LegacyDocumentV1 = { version: 1 } & Header & { strokes: LegacyStroke[] };
export type LegacyDocumentV2 = { version: 2 } & Header & {
		base: LegacyStroke[];
		tail: LegacyStroke[];
	};
export type LegacyDocument = LegacyDocumentV1 | LegacyDocumentV2;

export const LEGACY_LIMITS = {
	maxCompressedBytes: 256 * 1024,
	maxDecompressedBytes: 1024 * 1024,
	maxPointsPerStroke: 5_000,
	maxStrokes: 5_000,
	maxTotalPoints: 100_000
} as const;

const CANVAS: Record<DrawingKind, { width: number; height: number; background: string }> = {
	artwork: { width: 768, height: 768, background: '#fdfbf7' },
	avatar: { width: 340, height: 340, background: '#f5f0e1' }
};

const U32_MAX = 0xffff_ffff;
const COLOR = /^#[0-9a-fA-F]{6}$/;

const isU32 = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= U32_MAX;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (message: string) =>
	new StrokeDocumentError('INVALID_DOCUMENT', `Invalid drawing document: ${message}`);

const limitExceeded = (message: string) =>
	new StrokeDocumentError('LIMITS_EXCEEDED', `Drawing document exceeds ${message}`);

// serde's `deny_unknown_fields` plus its required fields.
const expectExactFields = (
	value: Record<string, unknown>,
	fields: readonly string[],
	at: string
) => {
	for (const key of Object.keys(value)) {
		if (!fields.includes(key)) throw invalid(`unknown field \`${key}\` in ${at}`);
	}
	for (const field of fields) {
		if (!(field in value)) throw invalid(`missing field \`${field}\` in ${at}`);
	}
};

const readStrokes = (value: unknown, at: string): LegacyStroke[] => {
	if (!Array.isArray(value)) throw invalid(`${at} must be an array`);

	return value.map((stroke, strokeIndex) => {
		const where = `${at}[${strokeIndex}]`;
		if (!isRecord(stroke)) throw invalid(`${where} must be an object`);
		expectExactFields(stroke, ['color', 'size', 'points'], where);
		const { color, size, points } = stroke;
		if (typeof color !== 'string') throw invalid(`${where}.color must be a string`);
		if (!isU32(size)) throw invalid(`${where}.size must be an unsigned integer`);
		if (!Array.isArray(points)) throw invalid(`${where}.points must be an array`);

		return {
			color,
			size,
			points: points.map((point, pointIndex): [number, number] => {
				if (!Array.isArray(point) || point.length !== 2 || !isU32(point[0]) || !isU32(point[1])) {
					throw invalid(`${where}.points[${pointIndex}] must be two unsigned integers`);
				}
				return [point[0], point[1]];
			})
		};
	});
};

const readHeader = (value: Record<string, unknown>): Header => {
	const { kind, width, height, background } = value;
	if (kind !== 'artwork' && kind !== 'avatar') throw invalid('kind must be artwork or avatar');
	if (!isU32(width) || !isU32(height)) throw invalid('width and height must be unsigned integers');
	if (typeof background !== 'string') throw invalid('background must be a string');
	return { kind, width, height, background };
};

const validateShape = (header: Header, collections: [string, LegacyStroke[]][]) => {
	const expected = CANVAS[header.kind];
	if (
		header.width !== expected.width ||
		header.height !== expected.height ||
		header.background !== expected.background
	) {
		throw invalid(
			`${header.kind} must be ${expected.width}x${expected.height} with ${expected.background}`
		);
	}

	for (const [name, strokes] of collections) {
		strokes.forEach((stroke, strokeIndex) => {
			const where = `${name}[${strokeIndex}]`;
			if (!COLOR.test(stroke.color)) throw invalid(`stroke ${where} has invalid color`);
			if (stroke.size < 1 || stroke.size > 64) {
				throw invalid(`stroke ${where} size must be between 1 and 64`);
			}
			if (stroke.points.length === 0) {
				throw invalid(`stroke ${where} must contain at least one point`);
			}
			stroke.points.forEach(([x, y], pointIndex) => {
				if (x > header.width || y > header.height) {
					throw invalid(`point ${where}.points[${pointIndex}] must be within the canvas`);
				}
			});
		});
	}
};

const renderableStrokes = (document: LegacyDocument) =>
	document.version === 1 ? document.strokes : [...document.base, ...document.tail];

const assertWithinComplexityLimits = (document: LegacyDocument) => {
	const strokes = renderableStrokes(document);
	if (strokes.length > LEGACY_LIMITS.maxStrokes) {
		throw limitExceeded(`max strokes of ${LEGACY_LIMITS.maxStrokes}`);
	}
	const totalPoints = strokes.reduce((total, stroke) => total + stroke.points.length, 0);
	if (totalPoints > LEGACY_LIMITS.maxTotalPoints) {
		throw limitExceeded(`max total points of ${LEGACY_LIMITS.maxTotalPoints}`);
	}
	if (strokes.some((stroke) => stroke.points.length > LEGACY_LIMITS.maxPointsPerStroke)) {
		throw limitExceeded(`max points per stroke of ${LEGACY_LIMITS.maxPointsPerStroke}`);
	}
};

export const parseLegacyDocument = (json: string): LegacyDocument => {
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		throw new StrokeDocumentError('INVALID_JSON', 'Invalid drawing document JSON');
	}
	if (!isRecord(value) || !isU32(value.version)) {
		throw new StrokeDocumentError('INVALID_JSON', 'Invalid drawing document JSON');
	}

	let document: LegacyDocument;
	if (value.version === 1) {
		expectExactFields(
			value,
			['version', 'kind', 'width', 'height', 'background', 'strokes'],
			'document'
		);
		const header = readHeader(value);
		const strokes = readStrokes(value.strokes, 'strokes');
		validateShape(header, [['strokes', strokes]]);
		document = { version: 1, ...header, strokes };
	} else if (value.version === 2) {
		expectExactFields(
			value,
			['version', 'kind', 'width', 'height', 'background', 'base', 'tail'],
			'document'
		);
		const header = readHeader(value);
		const base = readStrokes(value.base, 'base');
		const tail = readStrokes(value.tail, 'tail');
		validateShape(header, [
			['base', base],
			['tail', tail]
		]);
		document = { version: 2, ...header, base, tail };
	} else {
		throw new StrokeDocumentError(
			'INVALID_DOCUMENT',
			`Unsupported drawing document version: ${value.version}`
		);
	}

	assertWithinComplexityLimits(document);
	return document;
};

export const legacyDocumentMetadata = (document: LegacyDocument) => {
	const strokes = renderableStrokes(document);
	return {
		version: document.version,
		kind: document.kind,
		width: document.width,
		height: document.height,
		strokeCount: strokes.length,
		totalPoints: strokes.reduce((total, stroke) => total + stroke.points.length, 0)
	};
};

const toV2 = (document: LegacyDocument, v1Into: 'base' | 'tail'): LegacyDocumentV2 => {
	const { kind, width, height, background } = document;
	if (document.version === 2) {
		return {
			version: 2,
			kind,
			width,
			height,
			background,
			base: document.base,
			tail: document.tail
		};
	}
	return {
		version: 2,
		kind,
		width,
		height,
		background,
		base: v1Into === 'base' ? document.strokes : [],
		tail: v1Into === 'tail' ? document.strokes : []
	};
};

// What the studio opened for editing: a v1 drawing became the editable tail.
export const toEditableV2 = (document: LegacyDocument) => toV2(document, 'tail');

// What was stored and rendered: a v1 drawing became the settled base.
export const toCanonicalV2 = (document: LegacyDocument) => toV2(document, 'base');

const concatBytes = (chunks: Uint8Array[], total: number) => {
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
};

const singleChunkStream = (bytes: Uint8Array<ArrayBuffer>) =>
	new ReadableStream<BufferSource>({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		}
	});

// Gzips a canonical document for storage with the platform's CompressionStream,
// under the byte limits the Rust writer enforced.
export const encodeLegacyPayload = async (json: string): Promise<Uint8Array<ArrayBuffer>> => {
	const bytes = new TextEncoder().encode(json);
	if (bytes.byteLength > LEGACY_LIMITS.maxDecompressedBytes) {
		throw limitExceeded(`max decompressed bytes of ${LEGACY_LIMITS.maxDecompressedBytes}`);
	}

	const compressed = new Uint8Array(
		await new Response(
			singleChunkStream(bytes).pipeThrough(new CompressionStream('gzip'))
		).arrayBuffer()
	);
	if (compressed.byteLength > LEGACY_LIMITS.maxCompressedBytes) {
		throw limitExceeded(`max compressed bytes of ${LEGACY_LIMITS.maxCompressedBytes}`);
	}
	return compressed;
};

// Gunzips a stored payload with the platform's DecompressionStream, refusing
// oversized input and stopping as soon as the output passes the limit, so a
// zip bomb never inflates in memory.
export const decodeLegacyPayload = async (payload: Uint8Array<ArrayBuffer>): Promise<string> => {
	if (payload.byteLength > LEGACY_LIMITS.maxCompressedBytes) {
		throw limitExceeded(`max compressed bytes of ${LEGACY_LIMITS.maxCompressedBytes}`);
	}

	const reader = singleChunkStream(payload)
		.pipeThrough(new DecompressionStream('gzip'))
		.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > LEGACY_LIMITS.maxDecompressedBytes) {
				await reader.cancel();
				throw limitExceeded(`max output bytes of ${LEGACY_LIMITS.maxDecompressedBytes}`);
			}
			chunks.push(value);
		}
	} catch (error) {
		if (error instanceof StrokeDocumentError) throw error;
		throw new StrokeDocumentError(
			'DECOMPRESSION_FAILED',
			`Failed to decompress drawing document: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(concatBytes(chunks, total));
	} catch {
		throw new StrokeDocumentError('INVALID_JSON', 'Invalid drawing document JSON');
	}
};
