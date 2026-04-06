import { resolve } from 'node:path';
import process from 'node:process';
import {
	DEFAULT_BUILD_DIR,
	ensureBuildManifestExcludesRoutePrefix,
	ensureBuildOutput,
	ensureServerDependencyBundled,
	ensureServerWasmAsset,
	ensureServerWasmReferenced
} from '../src/lib/server/deploy/build';

const buildDir = resolve(process.cwd(), DEFAULT_BUILD_DIR);

await ensureBuildOutput(buildDir);
await ensureServerDependencyBundled(buildDir, 'gsap');
await ensureServerDependencyBundled(buildDir, '@not-the-louvre/stroke-json-runtime/server');
await ensureBuildManifestExcludesRoutePrefix(buildDir, '/demo');
await ensureServerWasmAsset(buildDir);
await ensureServerWasmReferenced(buildDir);

process.stdout.write(`Validated adapter-node build output at ${buildDir}\n`);
