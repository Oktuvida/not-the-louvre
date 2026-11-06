import { describe, expect, it } from 'vitest';
import { decodeDrawingV3, encodeDrawingV3 } from '../../stroke/v3';
import { createEmptyDrawingDocumentV2, type DrawingStroke } from './document';
import { fromInkDocument, toInkDocument } from './ink-document';

// Pressure is captured in the ten bits the document keeps.
const level = (step: number) => step / 1023;

const drawnStroke: DrawingStroke = {
	brush: 'round@1',
	color: '#1d3557',
	pointer: 'pen',
	points: [
		[100.25, 200.5],
		[110, 204.75]
	],
	pressures: [level(256), level(512)],
	size: 8,
	start: 640,
	times: [0, 12]
};

// A stroke from before v3: no brush, pointer or timing of its own.
const legacyStroke: DrawingStroke = {
	color: '#e76f51',
	points: [
		[10, 10],
		[20, 20],
		[30, 25]
	],
	size: 4
};

describe('the studio drawing as a v3 document', () => {
	it('keeps when and how every stroke was drawn', () => {
		const document = { ...createEmptyDrawingDocumentV2('artwork'), tail: [drawnStroke] };

		expect(toInkDocument(document).strokes).toEqual([drawnStroke]);
	});

	it('gives a stroke from before v3 the plain round brush and no timing', () => {
		const document = { ...createEmptyDrawingDocumentV2('artwork'), base: [legacyStroke] };

		expect(toInkDocument(document).strokes).toEqual([
			{ ...legacyStroke, brush: 'round@1', pointer: 'mouse', start: 0, times: [0, 0, 0] }
		]);
	});

	it('comes back from storage as the drawing it was', () => {
		const document = { ...createEmptyDrawingDocumentV2('artwork'), tail: [drawnStroke] };
		const stored = JSON.parse(JSON.stringify(encodeDrawingV3(toInkDocument(document))));

		expect(fromInkDocument(decodeDrawingV3(stored))).toEqual(document);
	});
});
