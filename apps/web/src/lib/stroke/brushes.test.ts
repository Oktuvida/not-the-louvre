import { describe, expect, it } from 'vitest';
import { drawingDocumentToSvg } from '../features/stroke-json/svg';
import { createEmptyDrawingDocumentV2, type DrawingStroke } from '../features/stroke-json/document';
import { inkOutline } from './brushes';

const level = (step: number) => step / 1023;

const penLine = (pressure: number): DrawingStroke => ({
	brush: 'ink@1',
	color: '#1d3557',
	pointer: 'pen',
	points: Array.from({ length: 40 }, (_, index) => [100 + index * 8, 300] as [number, number]),
	pressures: Array.from({ length: 40 }, () => level(Math.round(pressure * 1023))),
	size: 16,
	start: 0,
	times: Array.from({ length: 40 }, (_, index) => index * 4)
});

/** The outline's height across a horizontal line: how wide it was drawn. */
const thickness = (path: string) => {
	const ys = [...path.matchAll(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)].map((match) =>
		Number(match[1])
	);
	return Math.max(...ys) - Math.min(...ys);
};

describe('the ink brush', () => {
	it('outlines a pen stroke as one closed shape, the same every time', () => {
		const path = inkOutline(penLine(0.5));

		expect(path).toMatch(/^M[\d.-]+,[\d.-]+ .*Z$/);
		expect(inkOutline(penLine(0.5))).toBe(path);
	});

	it('draws wider where the pen presses harder', () => {
		expect(thickness(inkOutline(penLine(0.9)))).toBeGreaterThan(
			thickness(inkOutline(penLine(0.2)))
		);
	});

	it('keeps a single dot of ink', () => {
		const dot = {
			...penLine(0.5),
			points: [[200, 200]] as [number, number][],
			pressures: [0.5],
			times: [0]
		};

		expect(inkOutline(dot)).toMatch(/Z$/);
	});

	it('is what the published image fills', () => {
		const stroke = penLine(0.6);
		const svg = drawingDocumentToSvg({
			...createEmptyDrawingDocumentV2('artwork'),
			tail: [stroke]
		});

		expect(svg).toContain(`<path d="${inkOutline(stroke)}" fill="#1d3557"`);
	});
});
