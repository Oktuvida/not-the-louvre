import { describe, expect, it } from 'vitest';
import {
	ARTWORK_DRAWING_DIMENSIONS,
	serializeCanonicalDrawingDocument,
	type DrawingDocumentV2
} from './document';
import { compactDocumentWithClipper2 } from './phase2';

describe('stroke-json clipper2 phase 2 compaction', () => {
	it('preserves fragment metadata while compacting to a base-only document', async () => {
		const baseStrokePoints = Array.from(
			{ length: 61 },
			(_, index) => [40 + index * 4, index % 2 === 0 ? 120 : 124] as [number, number]
		);
		const document: DrawingDocumentV2 = {
			background: ARTWORK_DRAWING_DIMENSIONS.background,
			base: [
				{
					color: '#2d2420',
					points: baseStrokePoints,
					size: 4
				}
			],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [
				{
					color: '#c84f4f',
					points: [
						[140, 122],
						[220, 122]
					],
					size: 12
				}
			],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		};
		const before = serializeCanonicalDrawingDocument(document);

		const result = await compactDocumentWithClipper2(document);

		expect(result.tail).toEqual([]);
		expect(result.base.length).toBeGreaterThanOrEqual(2);
		expect(result.base.at(-1)).toEqual({
			color: '#c84f4f',
			points: [
				[140, 122],
				[220, 122]
			],
			size: 12
		});
		for (const stroke of result.base.slice(0, -1)) {
			expect(stroke).toMatchObject({ color: '#2d2420', size: 4 });
		}

		expect(serializeCanonicalDrawingDocument(document)).toBe(before);
	});

	it('drops a line hidden by a raster-solid zigzag fill', async () => {
		const document: DrawingDocumentV2 = {
			background: ARTWORK_DRAWING_DIMENSIONS.background,
			base: [
				{
					color: '#111111',
					points: [
						[150, 180],
						[210, 180]
					],
					size: 4
				}
			],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [
				{
					color: '#ff0000',
					points: Array.from({ length: 11 }, (_, row) =>
						row % 2 === 0 ? [140, 140 + row * 5] : [220, 140 + row * 5]
					),
					size: 8
				}
			],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		};

		const result = await compactDocumentWithClipper2(document);

		expect(result.tail).toEqual([]);
		expect(result.base).toEqual([
			{
				color: '#ff0000',
				points: [
					[140, 140],
					[220, 145],
					[140, 150],
					[220, 155],
					[140, 160],
					[220, 165],
					[140, 170],
					[220, 175],
					[140, 180],
					[220, 185],
					[140, 190]
				],
				size: 8
			}
		]);
	});

	it('drops a fully hidden dot', async () => {
		const document: DrawingDocumentV2 = {
			background: ARTWORK_DRAWING_DIMENSIONS.background,
			base: [
				{
					color: '#2d2420',
					points: [[160, 160]],
					size: 4
				}
			],
			height: ARTWORK_DRAWING_DIMENSIONS.height,
			kind: 'artwork',
			tail: [
				{
					color: '#c84f4f',
					points: [[160, 160]],
					size: 12
				}
			],
			version: 2,
			width: ARTWORK_DRAWING_DIMENSIONS.width
		};

		const result = await compactDocumentWithClipper2(document);

		expect(result.tail).toEqual([]);
		expect(result.base).toEqual([
			{
				color: '#c84f4f',
				points: [[160, 160]],
				size: 12
			}
		]);
	});

	it('keeps a partially hidden stroke intact when the raster guard cap is exceeded', async () => {
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

		const result = await compactDocumentWithClipper2(document, {
			maxStrokeCoveragePixels: 1
		});

		expect(result.tail).toEqual([]);
		expect(result.base).toEqual(document.base);
	});

	it('still drops a fully hidden stroke when the raster guard cap is exceeded', async () => {
		const document: DrawingDocumentV2 = {
			...ARTWORK_DRAWING_DIMENSIONS,
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
			kind: 'artwork',
			tail: [
				{
					color: '#c84f4f',
					points: [
						[48, 120],
						[720, 120]
					],
					size: 18
				}
			],
			version: 2
		};

		const result = await compactDocumentWithClipper2(document, {
			maxStrokeCoveragePixels: 1
		});

		expect(result.tail).toEqual([]);
		expect(result.base).toEqual([
			{
				color: '#c84f4f',
				points: [
					[48, 120],
					[720, 120]
				],
				size: 18
			}
		]);
	});
});
