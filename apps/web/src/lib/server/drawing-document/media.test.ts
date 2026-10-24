import { describe, expect, it } from 'vitest';
import {
	createEmptyDrawingDocument,
	type DrawingStroke
} from '#lib/features/stroke-json/document.js';
import { drawingDocumentToSvg } from '#lib/features/stroke-json/svg.js';
import { decodeImage, renderSvgToRaster } from '#lib/server/media/codecs/index.js';
import { createArtworkDrawingDocumentMedia, createAvatarDrawingDocumentMedia } from './media';

const countDifferentBytes = (left: Uint8ClampedArray, right: Uint8ClampedArray) => {
	let different = Math.abs(left.length - right.length);
	for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
		if (left[index] !== right[index]) different += 1;
	}
	return different;
};

describe('drawing-document backend media', () => {
	// The owner's rule: the gallery never shows a degraded drawing. The stored
	// image is the canonical render of the strokes, every pixel of it.
	it('stores the artwork exactly as its strokes render', async () => {
		const document = {
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
				},
				{
					color: '#c84f4f',
					points: [
						[600, 80],
						[120, 700]
					],
					size: 3
				}
			] satisfies DrawingStroke[]
		};

		const media = await createArtworkDrawingDocumentMedia(document);

		expect(media.contentType).toBe('image/webp');
		expect(media.file.type).toBe('image/webp');
		expect(media.width).toBe(768);
		expect(media.height).toBe(768);

		const stored = await decodeImage(new Uint8Array(await media.file.arrayBuffer()), 'webp');
		const canonical = await renderSvgToRaster(drawingDocumentToSvg(document), {
			height: 768,
			width: 768
		});
		expect(stored.width).toBe(768);
		expect(stored.height).toBe(768);
		expect(countDifferentBytes(stored.data, canonical.data)).toBe(0);
	});

	it('publishes a detailed drawing whose image outgrows the old 100 KB cap', async () => {
		let seed = 7;
		const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
		const palette = ['#1b1b1b', '#e63946', '#2a9d8f', '#e9c46a', '#8338ec', '#3a86ff'];
		const strokes: DrawingStroke[] = Array.from({ length: 1500 }, () => {
			let x = random() * 767;
			let y = random() * 767;
			return {
				color: palette[Math.floor(random() * palette.length)]!,
				points: Array.from({ length: 12 }, () => {
					x = Math.min(767, Math.max(0, x + (random() - 0.5) * 24));
					y = Math.min(767, Math.max(0, y + (random() - 0.5) * 24));
					return [Math.round(x), Math.round(y)] as [number, number];
				}),
				size: 1 + Math.floor(random() * 3)
			};
		});

		const media = await createArtworkDrawingDocumentMedia({
			...createEmptyDrawingDocument('artwork'),
			strokes
		});

		expect(media.sizeBytes).toBeGreaterThan(100 * 1024);
	});

	it('stores the avatar exactly as its strokes render', async () => {
		const document = {
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
			] satisfies DrawingStroke[]
		};

		const media = await createAvatarDrawingDocumentMedia(document);

		expect(media.contentType).toBe('image/webp');
		expect(media.width).toBe(256);
		expect(media.height).toBe(256);

		const stored = await decodeImage(new Uint8Array(await media.file.arrayBuffer()), 'webp');
		const canonical = await renderSvgToRaster(drawingDocumentToSvg(document), {
			height: 256,
			width: 256
		});
		expect(countDifferentBytes(stored.data, canonical.data)).toBe(0);
	});
});
