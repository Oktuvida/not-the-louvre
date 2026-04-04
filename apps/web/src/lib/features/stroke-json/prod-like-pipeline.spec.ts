import { describe, expect, it, vi } from 'vitest';
import { ARTWORK_DRAWING_DIMENSIONS, type DrawingDocumentV2, type DrawingPoint } from './document';
import {
	PROD_LIKE_PHASE1_ALGORITHM_ID,
	PROD_LIKE_PHASE1_HIGH_QUALITY,
	PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE,
	PROD_LIKE_PHASE2_ENGINE_ID,
	PROD_LIKE_PIPELINE_ITERATION_COUNT,
	runProdLikePipeline
} from './prod-like-pipeline';

const createDocument = (): DrawingDocumentV2 => ({
	background: '#fdfbf7',
	base: [
		{
			color: '#2d2420',
			points: [
				[10, 10],
				[20, 20]
			],
			size: 4
		}
	],
	height: 768,
	kind: 'artwork',
	tail: [],
	version: 2,
	width: 768
});

const clonePoints = (points: DrawingPoint[]) =>
	points.map((point) => [point[0], point[1]] as DrawingPoint);

describe('stroke-json prod-like pipeline', () => {
	it('exports the selected fixed pipeline constants', () => {
		expect(PROD_LIKE_PIPELINE_ITERATION_COUNT).toBe(20);
		expect(PROD_LIKE_PHASE1_ALGORITHM_ID).toBe('simplify-js');
		expect(PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE).toBe(0.5);
		expect(PROD_LIKE_PHASE1_HIGH_QUALITY).toBe(true);
		expect(PROD_LIKE_PHASE2_ENGINE_ID).toBe('clipper2-ts');
	});

	it('runs chained passes and returns one row per iteration by default', async () => {
		const seenInputPointCounts: number[] = [];
		const runPhase1 = vi.fn((document: DrawingDocumentV2) => {
			const stroke = document.base[0];
			if (!stroke) {
				throw new Error('Expected a base stroke');
			}

			seenInputPointCounts.push(stroke.points.length);

			return {
				...document,
				base: [
					{
						...stroke,
						points: [
							...clonePoints(stroke.points),
							[100 + stroke.points.length, 100 + stroke.points.length] as DrawingPoint
						]
					}
				]
			};
		});
		const runPhase2 = vi.fn(async (document: DrawingDocumentV2) => document);

		const result = await runProdLikePipeline(createDocument(), {
			runPhase1,
			runPhase2
		});

		expect(runPhase1).toHaveBeenCalledTimes(PROD_LIKE_PIPELINE_ITERATION_COUNT);
		expect(runPhase2).toHaveBeenCalledTimes(PROD_LIKE_PIPELINE_ITERATION_COUNT);
		expect(result.iterations).toHaveLength(PROD_LIKE_PIPELINE_ITERATION_COUNT);
		expect(seenInputPointCounts.slice(0, 4)).toEqual([2, 3, 4, 5]);
		expect(result.finalDocument).toEqual(result.iterations.at(-1)?.document);
		expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
		for (const iteration of result.iterations) {
			expect(iteration.rawBytes).toBeGreaterThan(0);
			expect(iteration.gzipBytes).toBeGreaterThan(0);
			expect(iteration.durationMs).toBeGreaterThanOrEqual(0);
		}
	});

	it('surfaces the failing pass when an intermediate iteration errors', async () => {
		let passNumber = 0;

		await expect(
			runProdLikePipeline(createDocument(), {
				iterationCount: 3,
				runPhase1: (document) => document,
				runPhase2: async (document) => {
					passNumber += 1;
					if (passNumber === 2) {
						throw new Error('clipper blew up');
					}

					return document;
				}
			})
		).rejects.toThrow(/pass 2/i);
	});

	it('forwards the raster guard cap into the default phase 2 compactor', async () => {
		const baseStrokePoints = Array.from(
			{ length: 61 },
			(_, index) => [40 + index * 4, index % 2 === 0 ? 120 : 124] as DrawingPoint
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

		const uncapped = await runProdLikePipeline(document, {
			iterationCount: 1,
			runPhase1: (currentDocument) => currentDocument
		});
		const capped = await runProdLikePipeline(document, {
			iterationCount: 1,
			phase2MaxStrokeCoveragePixels: 1,
			runPhase1: (currentDocument) => currentDocument
		});

		expect(uncapped.finalDocument.base).toHaveLength(3);
		expect(capped.finalDocument.base).toEqual([document.base[0]!, document.tail[0]!]);
		expect(capped.finalDocument.tail).toEqual([]);
	});
});
