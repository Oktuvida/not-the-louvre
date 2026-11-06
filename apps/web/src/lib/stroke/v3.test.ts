import { describe, expect, it } from 'vitest';
import { StrokeDocumentError } from './legacy';
import { decodeDrawingV3, encodeDrawingV3, type InkDocument, type InkStroke } from './v3';

// Pressure is kept in 10 bits; these are levels the format holds exactly.
const level = (step: number) => step / 1023;

const penStroke: InkStroke = {
	brush: 'ink@1',
	color: '#1d3557',
	pointer: 'pen',
	pressures: [level(512), level(634), level(716), level(419)],
	points: [
		[301.25, 220.5],
		[302.0, 219.75],
		[303.5, 218.0],
		[305.25, 216.25]
	],
	size: 8,
	start: 0,
	times: [0, 4, 8, 13]
};

const mouseStroke: InkStroke = {
	brush: 'round@1',
	color: '#e76f51',
	pointer: 'mouse',
	points: [
		[100, 100],
		[140, 120]
	],
	size: 12,
	start: 1350,
	times: [0, 16]
};

const eraserStroke: InkStroke = {
	brush: 'eraser@1',
	color: '#fdfbf7',
	pointer: 'touch',
	points: [[200, 200]],
	size: 24,
	start: 900,
	times: [0]
};

const drawing: InkDocument = {
	background: '#fdfbf7',
	height: 768,
	kind: 'artwork',
	strokes: [penStroke, mouseStroke, eraserStroke],
	width: 768
};

/** Through JSON and back, as storage does. */
const roundTrip = (document: InkDocument) =>
	decodeDrawingV3(JSON.parse(JSON.stringify(encodeDrawingV3(document))));

describe('the v3 drawing document', () => {
	it('keeps every point at a quarter of a pixel, with its time and pressure', () => {
		expect(roundTrip(drawing)).toEqual(drawing);
	});

	it('stores points as columns of differences, the first value whole', () => {
		const wire = encodeDrawingV3(drawing);

		expect(wire).toMatchObject({ pressureMax: 1023, version: 3, xyScale: 4 });
		expect(wire.strokes[0]).toMatchObject({
			x: [1205, 3, 6, 7],
			y: [882, -3, -7, -7],
			t: [0, 4, 4, 5],
			p: [512, 122, 82, -297]
		});
	});

	it('names each brush once and lets the strokes point at it', () => {
		const wire = encodeDrawingV3(drawing);

		expect(wire.brushes).toEqual(['ink@1', 'round@1', 'eraser@1']);
		expect(wire.strokes.map((stroke) => stroke.brush)).toEqual([0, 1, 2]);
	});

	it('keeps pressure for pen strokes only and colour off the eraser', () => {
		const [pen, mouse, eraser] = encodeDrawingV3(drawing).strokes;

		expect(pen).toHaveProperty('p');
		expect(mouse).not.toHaveProperty('p');
		expect(eraser).not.toHaveProperty('color');
		// The eraser paints with the paper, whatever colour it was handed.
		expect(roundTrip(drawing).strokes[2]?.color).toBe('#fdfbf7');
	});

	it('carries the artwork a fork was drawn on', () => {
		const fork: InkDocument = {
			...drawing,
			parent: {
				artwork: 'artwork-parent',
				document: 'documents/41d0.json.gz',
				image: 'artworks/author-1/artwork-parent.webp'
			}
		};

		expect(roundTrip(fork).parent).toEqual(fork.parent);
	});

	it('is smaller than the same strokes written as tuples', () => {
		const long: InkDocument = {
			...drawing,
			strokes: [
				{
					...penStroke,
					points: Array.from({ length: 2000 }, (_, index) => [
						100 + index * 0.25,
						300 + Math.sin(index / 20) * 40
					]),
					pressures: Array.from({ length: 2000 }, (_, index) => 0.5 + Math.sin(index / 30) / 4),
					times: Array.from({ length: 2000 }, (_, index) => index * 4)
				}
			]
		};

		const columns = JSON.stringify(encodeDrawingV3(long)).length;
		const tuples = JSON.stringify(long.strokes[0]?.points).length;
		expect(columns).toBeLessThan(tuples);
	});
});

describe('reading a v3 document refuses', () => {
	const wire = () => JSON.parse(JSON.stringify(encodeDrawingV3(drawing)));
	const refuses = (document: unknown, code = 'INVALID_DOCUMENT') => {
		expect(() => decodeDrawingV3(document)).toThrow(StrokeDocumentError);
		try {
			decodeDrawingV3(document);
		} catch (error) {
			expect((error as StrokeDocumentError).code).toBe(code);
		}
	};

	it('another version', () => refuses({ ...wire(), version: 2 }));

	it('a point off the canvas', () => {
		const document = wire();
		document.strokes[1].x = [3080, 0];
		refuses(document);
	});

	it('time that runs backwards', () => {
		const document = wire();
		document.strokes[0].t = [0, 4, -9, 5];
		refuses(document);
	});

	it('columns of different lengths', () => {
		const document = wire();
		document.strokes[0].y.pop();
		refuses(document);
	});

	it('a brush it does not know', () =>
		refuses({ ...wire(), brushes: ['ink@1', 'spray@9', 'eraser@1'] }));

	it('pressure past its scale', () => {
		const document = wire();
		document.strokes[0].p = [1024, 0, 0, 0];
		refuses(document);
	});

	it('more points than a drawing may hold', () => {
		expect(() =>
			decodeDrawingV3(wire(), {
				maxCompressedBytes: 1,
				maxDecompressedBytes: 1,
				maxPointsPerStroke: 100,
				maxStrokes: 100,
				maxTotalPoints: 6
			})
		).toThrow(/max total points of 6/);
	});
});
