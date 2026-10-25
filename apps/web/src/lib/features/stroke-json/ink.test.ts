import { describe, expect, it } from 'vitest';
import { createEmptyDrawingDocumentV2, type DrawingStroke } from './document';
import { INK_WARNING_LEVEL, measureInk } from './ink';

const line = (points: number, size = 8): DrawingStroke => ({
	color: '#2d2420',
	points: Array.from(
		{ length: points },
		(_, index) => [100 + (index % 500), 300] as [number, number]
	),
	size
});

const withTail = (...tail: DrawingStroke[]) => ({
	...createEmptyDrawingDocumentV2('artwork'),
	tail
});

describe('the ink a drawing has used', () => {
	it('is none for an empty page', () => {
		expect(measureInk(createEmptyDrawingDocumentV2('artwork'))).toMatchObject({
			remainingPoints: 300_000,
			remainingStrokes: 15_000,
			used: 0
		});
	});

	it('counts every point against the drawing’s budget', () => {
		const ink = measureInk(withTail(line(1000), line(1000)), { maxTotalPoints: 4000 });

		expect(ink.used).toBeCloseTo(0.5, 2);
		expect(ink.remainingPoints).toBe(2000);
	});

	it('runs out on whichever limit comes first', () => {
		const ink = measureInk(withTail(line(2), line(2), line(2)), { maxStrokes: 4 });

		expect(ink.used).toBeCloseTo(0.75, 2);
		expect(ink.remainingStrokes).toBe(1);
	});

	it('keeps the published document under the size the server accepts', () => {
		// 200 bytes of JSON leave room for a short line and nothing more.
		const ink = measureInk(withTail(line(5)), { maxDecompressedBytes: 200 });

		expect(ink.used).toBeGreaterThan(0.9);
		expect(ink.remainingPoints).toBe(0);
	});

	it('warns before it runs out', () => {
		expect(INK_WARNING_LEVEL).toBe(0.8);
		expect(measureInk(withTail(line(850)), { maxTotalPoints: 1000 }).used).toBeGreaterThan(
			INK_WARNING_LEVEL
		);
	});
});
