import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { drawingDocumentToSvg } from '../features/stroke-json/svg';
import { decodeImage, encodePng, renderSvgToRaster } from '../server/media/codecs/index';
import { GOLDEN_DRAWINGS } from './fixtures/golden-drawings';

/*
 * The published image of each golden drawing, pixel for pixel. Run with
 * UPDATE_GOLDENS=1 to write the images again after a deliberate change (a new
 * brush version), and look at them before committing.
 */
const goldenPath = (name: string) => new URL(`./fixtures/golden/${name}.png`, import.meta.url);

describe('the published image of a drawing', () => {
	for (const { document, name } of GOLDEN_DRAWINGS) {
		it(`draws ${name} exactly as its golden image`, async () => {
			const rendered = await renderSvgToRaster(drawingDocumentToSvg(document), {
				height: document.height,
				width: document.width
			});

			if (process.env.UPDATE_GOLDENS === '1') {
				await writeFile(goldenPath(name), await encodePng(rendered));
			}

			const golden = await decodeImage(new Uint8Array(await readFile(goldenPath(name))), 'png');
			expect(rendered.width).toBe(golden.width);
			expect(rendered.height).toBe(golden.height);
			expect(Buffer.from(rendered.data).equals(Buffer.from(golden.data))).toBe(true);
		});
	}
});
