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
	it('keeps stroke-count and points-per-stroke defaults at 5000', () => {
		expect(DEFAULT_DRAWING_DOCUMENT_LIMITS.maxPointsPerStroke).toBe(5000);
		expect(DEFAULT_DRAWING_DOCUMENT_LIMITS.maxStrokes).toBe(5000);
	});
});

describe('assertDrawingDocumentWithinLimits', () => {
	it('accepts a stroke with exactly 5000 points and rejects one with 5001', () => {
		const document = createEmptyDrawingDocument('artwork');
		document.strokes = [createStroke(DEFAULT_DRAWING_DOCUMENT_LIMITS.maxPointsPerStroke)];

		expect(() => assertDrawingDocumentWithinLimits(document)).not.toThrow();

		document.strokes = [createStroke(DEFAULT_DRAWING_DOCUMENT_LIMITS.maxPointsPerStroke + 1)];

		expect(() => assertDrawingDocumentWithinLimits(document)).toThrow(
			'Drawing document exceeds max points per stroke of 5000'
		);
	});

	it('accepts exactly 5000 strokes and rejects 5001', () => {
		const document = createEmptyDrawingDocument('artwork');
		document.strokes = Array.from({ length: DEFAULT_DRAWING_DOCUMENT_LIMITS.maxStrokes }, () =>
			createStroke(1)
		);

		expect(() => assertDrawingDocumentWithinLimits(document)).not.toThrow();

		document.strokes.push(createStroke(1));

		expect(() => assertDrawingDocumentWithinLimits(document)).toThrow(
			'Drawing document exceeds max strokes of 5000'
		);
	});
});
