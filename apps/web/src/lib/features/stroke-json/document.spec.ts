import { describe, expect, it } from 'vitest';
import {
	ARTWORK_DRAWING_DIMENSIONS,
	AVATAR_DRAWING_DIMENSIONS,
	assertDrawingDocumentWithinLimits,
	clampDrawingPoint,
	createEmptyDrawingDocument,
	getDrawingPointWithinBounds,
	parseDrawingDocument,
	serializeDrawingDocument
} from './document';
import { compressDrawingDocument, decompressDrawingDocument } from './storage';

describe('stroke-json drawing document', () => {
	it('accepts canonical artwork and avatar documents', () => {
		const artwork = createEmptyDrawingDocument('artwork');
		const avatar = createEmptyDrawingDocument('avatar');

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

	it('round-trips compressed documents without changing the payload', () => {
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

		const serialized = serializeDrawingDocument(document);
		const compressed = compressDrawingDocument(document);
		const decompressed = decompressDrawingDocument(compressed);

		expect(decompressed).toBe(serialized);
		expect(parseDrawingDocument(decompressed)).toEqual(document);
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
