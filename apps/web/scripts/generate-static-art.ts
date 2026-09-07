import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import {
	createMuseumWallPatternUrl,
	createMuseumWindowFrameUrl,
	createStickerBackgroundUrl
} from '../src/lib/features/home-entry-scene/canvas/museum-canvas';
import { getStickerControlPreset } from '../src/lib/features/shared-ui/sticker-controls';
import {
	STICKER_CONTROL_SIZES,
	STICKER_VARIANTS,
	museumWallPatternAssetUrl,
	museumWindowFrameAssetUrl,
	stickerBackgroundAssetUrl
} from '../src/lib/features/shared-ui/generated-art';

/*
 * Writes the generated museum artwork to `static/generated/` so the SSR HTML
 * can reference it by URL instead of carrying ~110-190KB of inline
 * `data:image/svg+xml` per document. The builders are pure string builders, so
 * this is deterministic: running it twice produces byte-identical files.
 *
 * The output is committed (dev and the vitest browser project serve `static/`
 * directly) and regenerated as the first step of `bun run build`, so a change
 * to the builders can never ship a stale texture.
 */

const SVG_DATA_URL_PREFIX = 'data:image/svg+xml,';

const decodeSvgDataUrl = (dataUrl: string) => {
	if (!dataUrl.startsWith(SVG_DATA_URL_PREFIX)) {
		throw new Error(`expected an svg data url, received: ${dataUrl.slice(0, 32)}…`);
	}

	return decodeURIComponent(dataUrl.slice(SVG_DATA_URL_PREFIX.length));
};

/** `/generated/museum-wall.v1.svg` → `museum-wall.v1.svg` */
const assetFileName = (assetUrl: string) => {
	const fileName = assetUrl.split('/').pop();

	if (!fileName) {
		throw new Error(`could not derive a file name from ${assetUrl}`);
	}

	return fileName;
};

const projectRoot = process.cwd();
const outputDirectory = resolve(projectRoot, 'static/generated');

const assets: Array<{ fileName: string; markup: string }> = [
	{
		fileName: assetFileName(museumWallPatternAssetUrl),
		markup: decodeSvgDataUrl(createMuseumWallPatternUrl())
	},
	{
		fileName: assetFileName(museumWindowFrameAssetUrl),
		markup: decodeSvgDataUrl(createMuseumWindowFrameUrl())
	}
];

for (const size of STICKER_CONTROL_SIZES) {
	const preset = getStickerControlPreset(size);

	for (const variant of STICKER_VARIANTS) {
		assets.push({
			fileName: assetFileName(stickerBackgroundAssetUrl(size, variant)),
			markup: decodeSvgDataUrl(
				createStickerBackgroundUrl(preset.minWidth, preset.height, { variant })
			)
		});
	}
}

// Recreated rather than merged so a version bump cannot leave the superseded
// files behind in the Workers asset bundle.
await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all(
	assets.map((asset) => writeFile(resolve(outputDirectory, asset.fileName), asset.markup, 'utf8'))
);

const written = (await readdir(outputDirectory)).length;

process.stdout.write(`Generated ${written} static art files in ${outputDirectory}\n`);
