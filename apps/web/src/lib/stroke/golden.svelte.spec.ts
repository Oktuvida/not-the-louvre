import { describe, expect, it } from 'vitest';
import { renderDrawingDocumentToCanvas } from '../features/stroke-json/canvas';
import { GOLDEN_DRAWINGS } from './fixtures/golden-drawings';

/*
 * The studio canvas against the published image (golden.test.ts keeps those
 * pixel for pixel). Chrome's Skia and resvg's tiny-skia antialias edges
 * differently, so edge pixels may differ a little; a stroke in the wrong
 * place, at the wrong width or with the wrong brush differs a lot.
 */

const goldenUrls = import.meta.glob('./fixtures/golden/*.png', {
	eager: true,
	import: 'default',
	query: '?url'
}) as Record<string, string>;

// A pixel counts as different past this much on any channel (of 255)...
const CHANNEL_TOLERANCE = 64;
// ...and the canvas matches the image while at most this share of pixels does.
const MAX_DIFFERENT_SHARE = 0.002;

const pixelsOf = async (source: CanvasImageSource, width: number, height: number) => {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d')!;
	context.drawImage(source, 0, 0);
	return context.getImageData(0, 0, width, height).data;
};

describe('the studio canvas draws what will be published', () => {
	for (const { document: drawing, name } of GOLDEN_DRAWINGS) {
		it(`draws ${name} as its published image`, async () => {
			const canvas = document.createElement('canvas');
			canvas.width = drawing.width;
			canvas.height = drawing.height;
			renderDrawingDocumentToCanvas(canvas, drawing);
			const drawn = canvas.getContext('2d')!.getImageData(0, 0, drawing.width, drawing.height).data;

			const response = await fetch(goldenUrls[`./fixtures/golden/${name}.png`]!);
			const golden = await pixelsOf(
				await createImageBitmap(await response.blob()),
				drawing.width,
				drawing.height
			);

			let different = 0;
			for (let index = 0; index < drawn.length; index += 4) {
				const delta = Math.max(
					Math.abs(drawn[index]! - golden[index]!),
					Math.abs(drawn[index + 1]! - golden[index + 1]!),
					Math.abs(drawn[index + 2]! - golden[index + 2]!)
				);
				if (delta > CHANNEL_TOLERANCE) different += 1;
			}
			const share = different / (drawing.width * drawing.height);

			expect(share, `${(share * 100).toFixed(3)}% of the pixels differ`).toBeLessThanOrEqual(
				MAX_DIFFERENT_SHARE
			);
		});
	}
});
