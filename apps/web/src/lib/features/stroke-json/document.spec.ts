import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DRAWING_DOCUMENT_LIMITS,
	assertDrawingDocumentWithinLimits,
	createEmptyDrawingDocument,
	type DrawingStroke
} from './document';

const createStroke = (pointCount: number): DrawingStroke => ({
	color: '#2d2420',
	points: Array.from({ length: pointCount }, () => [12, 24] as [number, number]),
	size: 5
});

describe('DEFAULT_DRAWING_DOCUMENT_LIMITS', () => {
	it('allows three times what the old runtime did', () => {
		expect(DEFAULT_DRAWING_DOCUMENT_LIMITS).toMatchObject({
			maxPointsPerStroke: 15_000,
			maxStrokes: 15_000,
			maxTotalPoints: 300_000
		});
	});
});

describe('assertDrawingDocumentWithinLimits', () => {
	it('accepts a stroke with exactly the most points a stroke may hold and rejects one more', () => {
		const document = createEmptyDrawingDocument('artwork');
		document.strokes = [createStroke(DEFAULT_DRAWING_DOCUMENT_LIMITS.maxPointsPerStroke)];

		expect(() => assertDrawingDocumentWithinLimits(document)).not.toThrow();

		document.strokes = [createStroke(DEFAULT_DRAWING_DOCUMENT_LIMITS.maxPointsPerStroke + 1)];

		expect(() => assertDrawingDocumentWithinLimits(document)).toThrow(
			'Drawing document exceeds max points per stroke of 15000'
		);
	});

	it('accepts exactly the most strokes a drawing may hold and rejects one more', () => {
		const document = createEmptyDrawingDocument('artwork');
		document.strokes = Array.from({ length: DEFAULT_DRAWING_DOCUMENT_LIMITS.maxStrokes }, () =>
			createStroke(1)
		);

		expect(() => assertDrawingDocumentWithinLimits(document)).not.toThrow();

		document.strokes.push(createStroke(1));

		expect(() => assertDrawingDocumentWithinLimits(document)).toThrow(
			'Drawing document exceeds max strokes of 15000'
		);
	});
});
