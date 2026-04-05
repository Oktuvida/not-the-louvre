import { mkdir, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import {
	DEFAULT_BUILD_DIR,
	ensureBuildManifestExcludesRoutePrefix,
	ensureBuildOutput,
	ensureServerDependencyBundled,
	ensureServerWasmAsset,
	ensureServerWasmReferenced,
	syncGeneratedServerWasmAsset,
	syncProductionRoutes
} from '../src/lib/server/deploy/build';

const projectRoot = process.cwd();
const sourceRoutesDirectory = resolve(projectRoot, 'src/routes');
const generatedSourceDirectory = resolve(projectRoot, '.generated/production-src');
const targetRoutesDirectory = resolve(generatedSourceDirectory, 'routes');
const generatedLibDirectory = resolve(generatedSourceDirectory, 'lib');
const sourceLibDirectory = resolve(projectRoot, 'src/lib');
const buildDirectory = resolve(projectRoot, DEFAULT_BUILD_DIR);
const generatedServerWasmPath = resolve(
	projectRoot,
	'../../packages/stroke-json-runtime/generated/wasm/server/stroke_json_wasm_bg.wasm'
);

try {
	await rm(generatedSourceDirectory, { force: true, recursive: true });
	await mkdir(generatedSourceDirectory, { recursive: true });
	await symlink(sourceLibDirectory, generatedLibDirectory, 'dir');
	await syncProductionRoutes(sourceRoutesDirectory, targetRoutesDirectory, ['demo']);
	process.stdout.write(`Prepared production routes at ${targetRoutesDirectory}\n`);

	const viteBuild = Bun.spawn(['vite', 'build'], {
		cwd: projectRoot,
		env: {
			...process.env,
			SVELTEKIT_ROUTES_DIR: '.generated/production-src/routes'
		},
		stderr: 'inherit',
		stdout: 'inherit'
	});

	const exitCode = await viteBuild.exited;

	if (exitCode !== 0) {
		throw new Error(`vite build failed with exit code ${exitCode}`);
	}

	await ensureBuildOutput(buildDirectory);
	await ensureServerDependencyBundled(buildDirectory, 'gsap');
	await ensureServerDependencyBundled(buildDirectory, '@not-the-louvre/stroke-json-runtime/server');
	await ensureBuildManifestExcludesRoutePrefix(buildDirectory, '/demo');
	await syncGeneratedServerWasmAsset(buildDirectory, generatedServerWasmPath);
	await ensureServerWasmAsset(buildDirectory);
	await ensureServerWasmReferenced(buildDirectory);

	process.stdout.write(`Validated adapter-node build output at ${buildDirectory}\n`);
} finally {
	await rm(generatedSourceDirectory, { force: true, recursive: true });
}
