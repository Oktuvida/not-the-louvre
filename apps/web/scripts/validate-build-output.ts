import { resolve } from 'node:path';
import process from 'node:process';
import {
	DEFAULT_CLOUDFLARE_BUILD_DIR,
	DEFAULT_CLOUDFLARE_MANIFEST_PATH,
	ensureManifestFileExcludesRoutePrefix,
	ensureServerDependencyBundled,
	ensureServerWasmAsset,
	ensureServerWasmModuleExternalized,
	ensureServerWasmReferenced,
	ensureWorkerBuildOutput
} from '../src/lib/server/deploy/build';

const cloudflareBuildDirectory = resolve(process.cwd(), DEFAULT_CLOUDFLARE_BUILD_DIR);
const cloudflareManifestPath = resolve(process.cwd(), DEFAULT_CLOUDFLARE_MANIFEST_PATH);
const svelteKitOutputDirectory = resolve(process.cwd(), '.svelte-kit/output');

await ensureWorkerBuildOutput(cloudflareBuildDirectory);
await ensureServerDependencyBundled(svelteKitOutputDirectory, 'gsap');
await ensureServerDependencyBundled(
	svelteKitOutputDirectory,
	'@not-the-louvre/stroke-json-runtime/server'
);
await ensureManifestFileExcludesRoutePrefix(cloudflareManifestPath, '/demo');
await ensureServerWasmModuleExternalized(svelteKitOutputDirectory);
await ensureServerWasmAsset(svelteKitOutputDirectory);
await ensureServerWasmReferenced(svelteKitOutputDirectory);

process.stdout.write(`Validated adapter-cloudflare build output at ${cloudflareBuildDirectory}\n`);
