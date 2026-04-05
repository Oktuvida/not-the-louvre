import { resolve } from 'node:path';
import process from 'node:process';
import {
	ensureServerDependencyBundled,
	ensureServerWasmAsset,
	ensureServerWasmReferenced,
	syncGeneratedServerWasmAsset
} from '../src/lib/server/deploy/build';

const projectRoot = process.cwd();
const svelteKitOutputDirectory = resolve(projectRoot, '.svelte-kit/output');
const generatedServerWasmPath = resolve(
	projectRoot,
	'../../packages/stroke-json-runtime/generated/wasm/server/stroke_json_wasm_bg.wasm'
);

const viteBuild = Bun.spawn(['vite', 'build'], {
	cwd: projectRoot,
	stderr: 'inherit',
	stdout: 'inherit'
});

const exitCode = await viteBuild.exited;

if (exitCode !== 0) {
	throw new Error(`vite build failed with exit code ${exitCode}`);
}

await syncGeneratedServerWasmAsset(svelteKitOutputDirectory, generatedServerWasmPath);
await ensureServerWasmAsset(svelteKitOutputDirectory);
await ensureServerDependencyBundled(
	svelteKitOutputDirectory,
	'@not-the-louvre/stroke-json-runtime/server'
);
await ensureServerWasmReferenced(svelteKitOutputDirectory);

process.stdout.write(`Prepared e2e server runtime assets under ${svelteKitOutputDirectory}\n`);
