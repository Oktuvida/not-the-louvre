import { describe, expect, it } from 'vitest';
import { createEmptyDrawingDocument, type DrawingPoint } from './document';
import {
	DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS,
	DEFAULT_CLIENT_PUBLISH_SAFE_RASTER_GUARD_PRESET_ID,
	prepareDrawingDocumentForPublish
} from './publish';

const createStroke = (startX: number, pointCount: number) => ({
	color: '#2d2420',
	points: Array.from(
		{ length: pointCount },
		(_, index) => [startX + index, 120 + (index % 2 === 0 ? 0 : 1)] as DrawingPoint
	),
	size: 4
});

describe('stroke-json client publish preparation', () => {
	it('keeps empty documents valid', () => {
		const result = prepareDrawingDocumentForPublish(createEmptyDrawingDocument('artwork'));

		expect(result.base).toEqual([]);
		expect(result.tail).toEqual([]);
	});

	it('converts V1 input into editable V2 and keeps all points in tail below the minimum', () => {
		const result = prepareDrawingDocumentForPublish({
			...createEmptyDrawingDocument('artwork'),
			strokes: [createStroke(10, 800)]
		});

		expect(result.base).toEqual([]);
		expect(result.tail).toHaveLength(1);
		expect(result.tail[0]?.points).toHaveLength(800);
	});

	it('protects the minimal complete-stroke suffix whose point count reaches the threshold', () => {
		const result = prepareDrawingDocumentForPublish({
			background: '#fdfbf7',
			base: [createStroke(10, 500), createStroke(600, 600)],
			height: 768,
			kind: 'artwork',
			tail: [createStroke(1300, 450)],
			version: 2,
			width: 768
		});

		expect(result.tail).toHaveLength(2);
		expect(result.tail[0]?.points).toHaveLength(600);
		expect(result.tail[1]?.points).toHaveLength(450);
		expect(result.base).toEqual([createStroke(10, 500)]);
	});

	it('allows tests to lower the protected tail threshold explicitly', () => {
		const result = prepareDrawingDocumentForPublish(
			{
				...createEmptyDrawingDocument('artwork'),
				strokes: [createStroke(10, 200), createStroke(300, 150)]
			},
			{ minTailPoints: 300 }
		);

		expect(result.tail).toHaveLength(2);
		expect(result.base).toEqual([]);
	});

	it('exports the client publish defaults', () => {
		expect(DEFAULT_CLIENT_PUBLISH_SAFE_RASTER_GUARD_PRESET_ID).toBe('veryConservative');
		expect(DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS).toBe(1000);
	});
});
