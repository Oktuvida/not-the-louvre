import { describe, expect, it } from 'vitest';
import { openStoredDrawingDocument } from './document-store';
import { createMemoryDrawingDocumentStore } from './memory-document-store';
import { prepareDrawingDocumentForStorage } from './storage';

const drawn = {
	background: '#fdfbf7',
	base: [],
	height: 768,
	kind: 'artwork',
	tail: [
		{
			color: '#1d3557',
			points: [
				[5, 5],
				[6, 7]
			],
			size: 8
		}
	],
	version: 2,
	width: 768
} as const;

describe('opening a stored drawing', () => {
	it('opens a drawing from object storage by its key', async () => {
		const { store } = createMemoryDrawingDocumentStore();
		const prepared = await prepareDrawingDocumentForStorage(JSON.stringify(drawn));
		const key = await store.put(prepared.compressed);

		await expect(
			openStoredDrawingDocument({ key, legacyBase64: null, version: 2 }, store)
		).resolves.toEqual(drawn);
	});

	it('still opens a drawing kept inline by a row from before the move', async () => {
		const { store } = createMemoryDrawingDocumentStore();
		const prepared = await prepareDrawingDocumentForStorage(JSON.stringify(drawn));
		const legacyBase64 = Buffer.from(prepared.compressed).toString('base64');

		await expect(
			openStoredDrawingDocument({ key: null, legacyBase64, version: 2 }, store)
		).resolves.toEqual(drawn);
	});

	it('reads an inline drawing whose chunked write never finished as no drawing', async () => {
		const { store } = createMemoryDrawingDocumentStore();

		await expect(
			openStoredDrawingDocument(
				{ key: null, legacyBase64: 'partial-compressed-docum', version: null },
				store
			)
		).resolves.toBeNull();
	});
});
