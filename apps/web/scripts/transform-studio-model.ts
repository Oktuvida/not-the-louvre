/// <reference types="node" />

import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, prune, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

/*
 * The home page's studio, from the scene as it was modelled
 * (`assets/models/studio.glb`) to the file the page loads. Run it with
 * `bun run model:transform:studio` after changing the model.
 *
 * - prune drops what nothing in the scene uses;
 * - draco compresses the geometry, which the page decodes with the decoder
 *   `scripts/copy-draco-decoder.ts` ships;
 * - the floor's parquet, the model's one image, goes from PNG to near-lossless
 *   WebP: no channel of any pixel moves by more than 2/255, at 40% of the
 *   bytes. Lossy WebP was smaller still, but moved pixels by up to 25/255.
 *
 * Nothing else changes: the scene keeps every node, mesh and material as
 * modelled, because the page finds the artwork slots and the side table's
 * sketchbook by name, and lays its surfaces out in each mesh's own space.
 *
 * The output lives in `src/lib/assets`, where Vite names it after its bytes,
 * so it can be cached for good and a new model always arrives under a new URL.
 */

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const sourcePath = resolve(appRoot, 'assets/models/studio.glb');
const outputPath = resolve(appRoot, 'src/lib/assets/studio-model/studio.glb');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
	'draco3d.decoder': await draco3d.createDecoderModule(),
	'draco3d.encoder': await draco3d.createEncoderModule()
});

const document = await io.read(sourcePath);

await document.transform(
	prune(),
	draco(),
	// sharp reads `quality` as the near-lossless preprocessing level here.
	textureCompress({ encoder: sharp, nearLossless: true, quality: 60, targetFormat: 'webp' })
);

mkdirSync(dirname(outputPath), { recursive: true });
await io.write(outputPath, document);

const kilobytes = (path: string) => Math.round(statSync(path).size / 1024);
console.log(
	`assets/models/studio.glb (${kilobytes(sourcePath)} KB) -> src/lib/assets/studio-model/studio.glb (${kilobytes(outputPath)} KB)`
);
