import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
	createEmptyDrawingDocument,
	normalizeDrawingDocumentToEditableV2,
	parseEditableDrawingDocumentV2,
	parseDrawingDocumentV2,
	serializeEditableDrawingDocument
} from '$lib/features/stroke-json/document';
import {
	decodeCompressedDrawingDocument,
	encodeCompressedDrawingDocument
} from '$lib/features/stroke-json/storage';
import { createArtworkDrawingDocumentMedia, createAvatarDrawingDocumentMedia } from './media';

describe('drawing-document backend media', () => {
	it('encodes and decodes editable V2 compressed drawing documents for persistence', () => {
		const document = {
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [[10, 12] as [number, number], [24, 32] as [number, number]],
					size: 5
				}
			]
		};

		const encoded = encodeCompressedDrawingDocument(document);
		const decoded = decodeCompressedDrawingDocument(encoded);

		expect(encoded.length).toBeGreaterThan(0);
		expect(decoded).toBe(serializeEditableDrawingDocument(document));
		expect(parseEditableDrawingDocumentV2(decoded)).toEqual(
			normalizeDrawingDocumentToEditableV2(document)
		);
		expect(parseDrawingDocumentV2(decoded)).toEqual(normalizeDrawingDocumentToEditableV2(document));
	});

	it('derives canonical artwork avif from an artwork drawing document', async () => {
		const media = await createArtworkDrawingDocumentMedia({
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [
						[48, 48],
						[320, 320],
						[540, 220]
					],
					size: 12
				}
			]
		});

		expect(media.contentType).toBe('image/avif');
		expect(media.width).toBe(768);
		expect(media.height).toBe(768);
		expect(media.sizeBytes).toBeGreaterThan(0);

		const metadata = await sharp(Buffer.from(await media.file.arrayBuffer())).metadata();
		expect(metadata.width).toBe(768);
		expect(metadata.height).toBe(768);
	});

	it('derives canonical avatar avif from an avatar drawing document', async () => {
		const media = await createAvatarDrawingDocumentMedia({
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2d2420',
					points: [
						[40, 40],
						[120, 120],
						[200, 90]
					],
					size: 10
				}
			]
		});

		expect(media.contentType).toBe('image/avif');
		expect(media.width).toBe(256);
		expect(media.height).toBe(256);
		expect(media.sizeBytes).toBeGreaterThan(0);

		const metadata = await sharp(Buffer.from(await media.file.arrayBuffer())).metadata();
		expect(metadata.width).toBe(256);
		expect(metadata.height).toBe(256);
	});
});
