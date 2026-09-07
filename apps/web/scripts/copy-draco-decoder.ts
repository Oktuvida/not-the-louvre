import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

/*
 * Copies the GLTF DRACO decoder out of the *resolved* `three` package into
 * static/draco/, so it is served from our own origin and edge instead of
 * www.gstatic.com. The GLB declares `extensionsRequired:
 * ['KHR_draco_mesh_compression']`, so this download is mandatory for every
 * visitor and it is discovered late — only after the 578KB model header is
 * parsed. A third-party DNS + TLS handshake at that point is the worst place
 * for one, and it made the 3D studio depend on gstatic staying reachable.
 *
 * Re-copying from the resolved package (rather than hand-vendoring a snapshot)
 * is what keeps the decoder in step with the pinned three version on upgrade.
 */

const require = createRequire(import.meta.url);
const threePackagePath = require.resolve('three/package.json');
const threeRoot = dirname(threePackagePath);
const decoderSourceDirectory = resolve(threeRoot, 'examples/jsm/libs/draco/gltf');
const decoderTargetDirectory = resolve(process.cwd(), 'static/draco');

// draco_wasm_wrapper.js + draco_decoder.wasm are the production pair;
// draco_decoder.js backs the `type: 'js'` fallback the loader selects for
// Firefox in dev. draco_encoder.js is never used and stays out.
const DECODER_FILES = ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js'];

const threeVersion = JSON.parse(await readFile(threePackagePath, 'utf8')).version as string;

await mkdir(decoderTargetDirectory, { recursive: true });

await Promise.all(
	DECODER_FILES.map((fileName) =>
		copyFile(resolve(decoderSourceDirectory, fileName), resolve(decoderTargetDirectory, fileName))
	)
);

process.stdout.write(
	`Copied the DRACO decoder from three@${threeVersion} to ${decoderTargetDirectory}\n`
);
