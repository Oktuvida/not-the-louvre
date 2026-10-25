import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeDrawingDocument, prepareDrawingDocumentForStorage } from './storage';
import { DRAWING_LIMITS } from '#lib/shared/artwork/drawing-limits.js';

const artwork = { kind: 'artwork', width: 768, height: 768, background: '#fdfbf7' } as const;
const stroke = (points: [number, number][], color = '#1d3557', size = 8) => ({
	color,
	size,
	points
});

describe('drawing document storage', () => {
	it('stores a published drawing so the studio reopens exactly what was drawn', async () => {
		const drawn = {
			version: 2,
			...artwork,
			base: [stroke([[1, 2]], '#264653', 64)],
			tail: [
				stroke([
					[5, 5],
					[6, 7]
				])
			]
		};

		const prepared = await prepareDrawingDocumentForStorage(JSON.stringify(drawn));
		const reopened = await decodeDrawingDocument(prepared.compressed);

		expect(prepared.version).toBe(2);
		expect(prepared.document).toEqual(drawn);
		expect(reopened).toEqual(drawn);
	});

	it('stores a version 1 drawing as the settled base of a version 2 document', async () => {
		const drawn = { version: 1, ...artwork, strokes: [stroke([[10, 10]])] };

		const prepared = await prepareDrawingDocumentForStorage(JSON.stringify(drawn));
		const stored = JSON.parse(gunzipSync(prepared.compressed).toString('utf8'));

		expect(stored).toEqual({ version: 2, ...artwork, base: drawn.strokes, tail: [] });
	});

	it('rejects a drawing that breaks the document rules as a client error', async () => {
		const offCanvas = { version: 1, ...artwork, strokes: [stroke([[769, 0]])] };

		await expect(prepareDrawingDocumentForStorage(JSON.stringify(offCanvas))).rejects.toMatchObject(
			{
				code: 'INVALID_DRAWING_DOCUMENT',
				status: 400
			}
		);
		await expect(prepareDrawingDocumentForStorage('{not json')).rejects.toMatchObject({
			code: 'INVALID_DRAWING_DOCUMENT',
			status: 400
		});
	});

	it('rejects a drawing over the size limits as too large', async () => {
		const overLimit = {
			version: 1,
			...artwork,
			strokes: [
				stroke(
					Array.from(
						{ length: DRAWING_LIMITS.maxPointsPerStroke + 1 },
						(_, i) => [i % 769, 0] as [number, number]
					)
				)
			]
		};

		await expect(prepareDrawingDocumentForStorage(JSON.stringify(overLimit))).rejects.toMatchObject(
			{ code: 'DRAWING_DOCUMENT_TOO_LARGE', status: 413 }
		);
	});

	it('refuses a stored payload that is not a gzip document', async () => {
		await expect(
			decodeDrawingDocument(new TextEncoder().encode('plain') as Uint8Array<ArrayBuffer>)
		).rejects.toMatchObject({ code: 'INVALID_DRAWING_DOCUMENT', status: 400 });
	});
});
