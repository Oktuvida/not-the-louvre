import { describe, expect, it } from 'vitest';
import {
	compactDrawingDocumentLosslessly,
	compactDrawingDocumentLosslesslyWithReport,
	getRasterCoveragePixelIndices,
	resolveSafeRasterGuardPreset
} from './compaction';
import {
	ARTWORK_DRAWING_DIMENSIONS,
	AVATAR_DRAWING_DIMENSIONS,
	DEFAULT_DRAWING_DOCUMENT_LIMITS,
	assertDrawingDocumentWithinLimits,
	clampDrawingPoint,
	createEmptyDrawingDocument,
	createEmptyDrawingDocumentV2,
	getDrawingPointWithinBounds,
	normalizeDrawingDocumentToEditableV2,
	normalizeDrawingDocumentToV2,
	parseEditableDrawingDocumentV2,
	parseDrawingDocument,
	parseDrawingDocumentV2,
	parseVersionedDrawingDocument,
	serializeDrawingDocument,
	serializeCanonicalDrawingDocument,
	serializeEditableDrawingDocument
} from './document';
import {
	compressDrawingDocument,
	decodeCompressedDrawingDocument,
	decompressDrawingDocument,
	encodeCompressedDrawingDocument
} from './storage';

describe('stroke-json drawing document', () => {
	it('accepts canonical artwork and avatar documents', () => {
		const artwork = createEmptyDrawingDocument('artwork');
		const avatar = createEmptyDrawingDocument('avatar');
		const artworkV2 = createEmptyDrawingDocumentV2('artwork');

		expect(artwork).toMatchObject({
			background: '#fdfbf7',
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			width: ARTWORK_DRAWING_DIMENSIONS.width
		});
		expect(avatar).toMatchObject({
			background: '#f5f0e1',
			height: AVATAR_DRAWING_DIMENSIONS.height,
			kind: 'avatar',
			width: AVATAR_DRAWING_DIMENSIONS.width
		});
		expect(artworkV2).toMatchObject({
			background: '#fdfbf7',
			base: [],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		});
	});

	it('rejects documents with invalid kind dimensions', () => {
		const invalidDocument = JSON.stringify({
			background: '#fdfbf7',
			height: 512,
			kind: 'artwork',
			strokes: [],
			version: 1,
			width: 512
		});

		expect(() => parseDrawingDocument(invalidDocument)).toThrow(/768/);
	});

	it('compresses documents into editable V2 payloads for persistence without default compaction', () => {
		const document = {
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [
						[10, 12] as [number, number],
						[16, 18] as [number, number],
						[24, 32] as [number, number]
					],
					size: 5
				}
			]
		};

		const expected = normalizeDrawingDocumentToEditableV2(document);
		const compressed = compressDrawingDocument(document);
		const decompressed = decompressDrawingDocument(compressed);

		expect(decompressed).toBe(serializeEditableDrawingDocument(expected));
		expect(parseEditableDrawingDocumentV2(decompressed)).toEqual(expected);
	});

	it('encodes base64 compressed documents as editable V2 payloads', () => {
		const document = {
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [
						[16, 18] as [number, number],
						[32, 48] as [number, number],
						[64, 96] as [number, number]
					],
					size: 6
				}
			]
		};

		const expected = normalizeDrawingDocumentToEditableV2(document);
		const encoded = encodeCompressedDrawingDocument(document);
		const decoded = decodeCompressedDrawingDocument(encoded);

		expect(decoded).toBe(serializeEditableDrawingDocument(expected));
		expect(parseEditableDrawingDocumentV2(decoded)).toEqual(expected);
	});

	it('keeps storage uncompact by default and still allows explicit compaction overrides', () => {
		const baseStrokePoints = Array.from(
			{ length: 41 },
			(_, index) => [20 + index * 7, index % 2 === 0 ? 118 : 122] as [number, number]
		);
		const document = {
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2d2420',
					points: baseStrokePoints,
					size: 4
				},
				{
					color: '#c84f4f',
					points: [[120, 120] as [number, number], [220, 120] as [number, number]],
					size: 20
				}
			]
		};
		const dimensions = { height: document.height, width: document.width };
		const veryConservativePreset = resolveSafeRasterGuardPreset('veryConservative', dimensions);
		const editable = normalizeDrawingDocumentToEditableV2(document);
		const canonical = compactDrawingDocumentLosslessly(editable);
		const veryConservative = compactDrawingDocumentLosslesslyWithReport(editable, {
			maxStrokeCoveragePixels: veryConservativePreset.maxStrokeCoveragePixels
		}).document;

		expect(veryConservativePreset.maxStrokeCoveragePixels).not.toBeNull();
		expect(getRasterCoveragePixelIndices(editable.tail[0]!, dimensions).length).toBeGreaterThan(
			veryConservativePreset.maxStrokeCoveragePixels!
		);
		expect(canonical.base).toHaveLength(3);
		expect(veryConservative.base).toEqual(editable.tail);

		const defaultDecoded = decompressDrawingDocument(compressDrawingDocument(document));
		const veryConservativeOverrideDecoded = decompressDrawingDocument(
			compressDrawingDocument(document, DEFAULT_DRAWING_DOCUMENT_LIMITS, {
				rasterGuardPresetId: 'veryConservative'
			})
		);

		expect(parseEditableDrawingDocumentV2(defaultDecoded)).toEqual(editable);
		expect(parseDrawingDocumentV2(veryConservativeOverrideDecoded)).toEqual(veryConservative);
		expect(parseDrawingDocumentV2(defaultDecoded)).toEqual(normalizeDrawingDocumentToV2(editable));
	});

	it('parses legacy V1 payloads into editable V2 by placing legacy strokes in tail', () => {
		const serialized = serializeDrawingDocument({
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2d2420',
					points: [
						[20, 20],
						[26, 24],
						[32, 20]
					],
					size: 5
				}
			]
		});

		expect(parseEditableDrawingDocumentV2(serialized)).toEqual({
			background: '#f5f0e1',
			base: [],
			height: AVATAR_DRAWING_DIMENSIONS.height,
			kind: 'avatar',
			tail: [
				{
					color: '#2d2420',
					points: [
						[20, 20],
						[26, 24],
						[32, 20]
					],
					size: 5
				}
			],
			version: 2,
			width: AVATAR_DRAWING_DIMENSIONS.width
		});
	});

	it('accepts V2 documents and exposes both flat and versioned views', () => {
		const serialized = JSON.stringify({
			background: '#fdfbf7',
			base: [
				{
					color: '#2d2420',
					points: [[10, 12] as [number, number], [24, 32] as [number, number]],
					size: 5
				}
			],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [
				{
					color: '#c84f4f',
					points: [[30, 30] as [number, number], [48, 48] as [number, number]],
					size: 7
				}
			],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		});

		expect(parseVersionedDrawingDocument(serialized)).toEqual({
			background: '#fdfbf7',
			base: [
				{
					color: '#2d2420',
					points: [
						[10, 12],
						[24, 32]
					],
					size: 5
				}
			],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [
				{
					color: '#c84f4f',
					points: [
						[30, 30],
						[48, 48]
					],
					size: 7
				}
			],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		});

		expect(parseDrawingDocument(serialized)).toEqual({
			background: '#fdfbf7',
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			strokes: [
				{
					color: '#2d2420',
					points: [
						[10, 12],
						[24, 32]
					],
					size: 5
				},
				{
					color: '#c84f4f',
					points: [
						[30, 30],
						[48, 48]
					],
					size: 7
				}
			],
			version: 1,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		});

		expect(parseDrawingDocumentV2(serialized)).toEqual({
			background: '#fdfbf7',
			base: [
				{
					color: '#2d2420',
					points: [
						[10, 12],
						[24, 32]
					],
					size: 5
				}
			],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [
				{
					color: '#c84f4f',
					points: [
						[30, 30],
						[48, 48]
					],
					size: 7
				}
			],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		});
	});

	it('canonical serialization always emits minified V2 json with stable field ordering', () => {
		const document = {
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [[10, 12] as [number, number], [24, 32] as [number, number]],
					size: 5
				}
			]
		};

		expect(serializeCanonicalDrawingDocument(document)).toBe(
			'{"version":2,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","base":[{"color":"#2d2420","size":5,"points":[[10,12],[24,32]]}],"tail":[]}'
		);
	});

	it('rejects documents that exceed aggregate point limits', () => {
		const document = {
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [
						[0, 0] as [number, number],
						[1, 1] as [number, number],
						[2, 2] as [number, number],
						[3, 3] as [number, number]
					],
					size: 5
				}
			]
		};

		expect(() =>
			assertDrawingDocumentWithinLimits(document, {
				maxCompressedBytes: 1024,
				maxDecompressedBytes: 1024,
				maxPointsPerStroke: 3,
				maxStrokes: 10,
				maxTotalPoints: 10
			})
		).toThrow(/points per stroke/i);
	});

	it('rejects decompression outputs that exceed the configured limit', () => {
		const compressed = compressDrawingDocument({
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: Array.from({ length: 300 }, (_, index) => [index, index] as [number, number]),
					size: 5
				}
			]
		});

		expect(() => decompressDrawingDocument(compressed, { maxOutputBytes: 64 })).toThrow(
			/max output/i
		);
	});

	it('clamps captured points so replay never serializes negative or overflow coordinates', () => {
		const dimensions = createEmptyDrawingDocument('artwork');

		expect(clampDrawingPoint([-4.7, -8.2], dimensions)).toEqual([0, 0]);
		expect(clampDrawingPoint([192.3, 221.8], dimensions)).toEqual([192, 222]);
		expect(clampDrawingPoint([900.6, 901.2], dimensions)).toEqual([
			ARTWORK_DRAWING_DIMENSIONS.width,
			ARTWORK_DRAWING_DIMENSIONS.height
		]);
	});

	it('ignores points outside the canvas rect and only returns points once the pointer is back inside', () => {
		const dimensions = createEmptyDrawingDocument('artwork');

		expect(getDrawingPointWithinBounds([-0.1, 32], dimensions)).toBeNull();
		expect(getDrawingPointWithinBounds([32, -0.1], dimensions)).toBeNull();
		expect(
			getDrawingPointWithinBounds([ARTWORK_DRAWING_DIMENSIONS.width + 0.1, 64], dimensions)
		).toBeNull();
		expect(
			getDrawingPointWithinBounds([64, ARTWORK_DRAWING_DIMENSIONS.height + 0.1], dimensions)
		).toBeNull();

		expect(getDrawingPointWithinBounds([192.3, 221.8], dimensions)).toEqual([192, 222]);
		expect(
			getDrawingPointWithinBounds(
				[ARTWORK_DRAWING_DIMENSIONS.width, ARTWORK_DRAWING_DIMENSIONS.height],
				dimensions
			)
		).toEqual([ARTWORK_DRAWING_DIMENSIONS.width, ARTWORK_DRAWING_DIMENSIONS.height]);
	});
});
