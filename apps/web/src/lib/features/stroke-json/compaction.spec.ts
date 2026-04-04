import { describe, expect, it } from 'vitest';
import {
	ARTWORK_DRAWING_DIMENSIONS,
	createEmptyDrawingDocumentV2,
	serializeCanonicalDrawingDocument,
	type DrawingDocumentV2
} from './document';
import {
	compactDrawingDocumentLosslessly,
	compactDrawingDocumentLosslesslyWithReport,
	getRasterCoveragePixelIndices,
	normalizeDrawingStrokeExactly
} from './compaction';

describe('stroke-json V2 compaction', () => {
	it('normalizes duplicate and strictly collinear points without mutating the stroke', () => {
		const stroke = {
			color: '#2d2420',
			points: [
				[10, 10] as [number, number],
				[10, 10] as [number, number],
				[20, 20] as [number, number],
				[30, 30] as [number, number],
				[40, 40] as [number, number]
			],
			size: 6
		};

		const normalized = normalizeDrawingStrokeExactly(stroke);

		expect(normalized).toEqual({
			color: '#2d2420',
			points: [
				[10, 10],
				[40, 40]
			],
			size: 6
		});
		expect(stroke.points).toEqual([
			[10, 10],
			[10, 10],
			[20, 20],
			[30, 30],
			[40, 40]
		]);
	});

	it('covers pixels conservatively for dots and clips coverage to the canvas bounds', () => {
		const coverage = getRasterCoveragePixelIndices(
			{
				color: '#2d2420',
				points: [[0, 0]],
				size: 2
			},
			{ height: 4, width: 4 }
		);

		expect(coverage).toEqual([0, 1, 4]);
	});

	it('drops fully hidden strokes, clears tail, and keeps the input object unchanged', () => {
		const document: DrawingDocumentV2 = {
			...createEmptyDrawingDocumentV2('artwork'),
			base: [
				{
					color: '#2d2420',
					points: [
						[48, 120],
						[720, 120]
					],
					size: 6
				}
			],
			tail: [
				{
					color: '#c84f4f',
					points: [
						[48, 120],
						[720, 120]
					],
					size: 18
				}
			]
		};
		const before = serializeCanonicalDrawingDocument(document);

		const compacted = compactDrawingDocumentLosslessly(document);

		expect(compacted.tail).toEqual([]);
		expect(compacted.base).toEqual([
			{
				color: '#c84f4f',
				points: [
					[48, 120],
					[720, 120]
				],
				size: 18
			}
		]);
		expect(serializeCanonicalDrawingDocument(document)).toBe(before);
	});

	it('splits an older stroke around a hidden interior span when the split is smaller', () => {
		const baseStrokePoints = Array.from(
			{ length: 81 },
			(_, index) => [80 + index * 6, index % 2 === 0 ? 258 : 262] as [number, number]
		);
		const document: DrawingDocumentV2 = {
			background: ARTWORK_DRAWING_DIMENSIONS.background,
			base: [
				{
					color: '#2d2420',
					points: baseStrokePoints,
					size: 4
				},
				{
					color: '#c84f4f',
					points: [
						[260, 260],
						[380, 260]
					],
					size: 20
				}
			],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		};

		const compacted = compactDrawingDocumentLosslessly(document);

		expect(compacted.tail).toEqual([]);
		expect(compacted.base).toHaveLength(3);
		expect(compacted.base[0]?.points.at(-1)?.[0]).toBeLessThan(260);
		expect(compacted.base[1]?.points[0]?.[0]).toBeGreaterThan(380);
		expect(compacted.base[2]).toEqual({
			color: '#c84f4f',
			points: [
				[260, 260],
				[380, 260]
			],
			size: 20
		});
		expect(serializeCanonicalDrawingDocument(compacted).length).toBeLessThan(
			serializeCanonicalDrawingDocument(document).length
		);
	});

	it('keeps a partially hidden stroke intact when the raster guard cap is exceeded', () => {
		const baseStrokePoints = Array.from(
			{ length: 81 },
			(_, index) => [80 + index * 6, index % 2 === 0 ? 258 : 262] as [number, number]
		);
		const document: DrawingDocumentV2 = {
			background: ARTWORK_DRAWING_DIMENSIONS.background,
			base: [
				{
					color: '#2d2420',
					points: baseStrokePoints,
					size: 4
				},
				{
					color: '#c84f4f',
					points: [
						[260, 260],
						[380, 260]
					],
					size: 20
				}
			],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		};

		const result = compactDrawingDocumentLosslesslyWithReport(document, {
			maxStrokeCoveragePixels: 1
		});

		expect(result.document.tail).toEqual([]);
		expect(result.document.base).toEqual(document.base);
		expect(result.stats.maxStrokeCoveragePixels).toBe(1);
		expect(result.stats.skippedPartialCompactionStrokeCount).toBe(1);
		expect(result.stats.largestSkippedStrokeCoveragePixels).toBeGreaterThan(1);
	});

	it('still drops a fully hidden stroke even when the raster guard cap is exceeded', () => {
		const document: DrawingDocumentV2 = {
			...createEmptyDrawingDocumentV2('artwork'),
			base: [
				{
					color: '#2d2420',
					points: [
						[48, 120],
						[720, 120]
					],
					size: 6
				}
			],
			tail: [
				{
					color: '#c84f4f',
					points: [
						[48, 120],
						[720, 120]
					],
					size: 18
				}
			]
		};

		const result = compactDrawingDocumentLosslesslyWithReport(document, {
			maxStrokeCoveragePixels: 1
		});

		expect(result.document.tail).toEqual([]);
		expect(result.document.base).toEqual([
			{
				color: '#c84f4f',
				points: [
					[48, 120],
					[720, 120]
				],
				size: 18
			}
		]);
		expect(result.stats.skippedPartialCompactionStrokeCount).toBe(0);
	});
});
