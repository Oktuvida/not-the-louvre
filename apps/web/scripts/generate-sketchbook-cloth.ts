import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import {
	weaveBookcloth,
	wearSketchbookCover,
	type Raster
} from '../src/lib/features/shared-ui/sketchbook/bookcloth';

/*
 * Draws the sketchbook's bookcloth tile and the wear of its cover into
 * src/lib/assets/sketchbook/, where the studio desk's CSS cover and the 3D
 * book on the home's side table both import them (see
 * shared-ui/sketchbook/cover.ts).
 *
 * Run it by hand — `bun run sketchbook:cloth` — when the cloth or the wear
 * changes; the WebP files are committed. Like the og card, they are design
 * assets to review by eye, not something to regenerate silently on every
 * build. The generator is seeded, so the same code draws the same bytes.
 */

const outputDirectory = resolve(process.cwd(), 'src/lib/assets/sketchbook');

const write = async (name: string, raster: Raster, options: sharp.WebpOptions) => {
	const path = resolve(outputDirectory, name);
	await sharp(Buffer.from(raster.data.buffer), {
		raw: { channels: 4, height: raster.height, width: raster.width }
	})
		.webp({ effort: 6, smartSubsample: true, ...options })
		.toFile(path);
	const { size } = await stat(path);
	console.log(`${name}: ${raster.width}×${raster.height}, ${(size / 1024).toFixed(1)} KB`);
};

await mkdir(outputDirectory, { recursive: true });
await write('bookcloth.webp', weaveBookcloth(), { quality: 78 });
await write('cover-wear.webp', wearSketchbookCover(), { alphaQuality: 72, quality: 78 });
