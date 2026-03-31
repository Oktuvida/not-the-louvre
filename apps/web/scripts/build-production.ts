import { mkdir, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import {
	DEFAULT_BUILD_DIR,
	ensureBuildManifestExcludesRoutePrefix,
	ensureBuildOutput,
	ensureServerDependencyBundled,
	syncProductionRoutes
} from '../src/lib/server/deploy/build';

const projectRoot = process.cwd();
const sourceRoutesDirectory = resolve(projectRoot, 'src/routes');
const generatedSourceDirectory = resolve(projectRoot, '.generated/production-src');
const targetRoutesDirectory = resolve(generatedSourceDirectory, 'routes');
const generatedLibDirectory = resolve(generatedSourceDirectory, 'lib');
const sourceLibDirectory = resolve(projectRoot, 'src/lib');
const buildDirectory = resolve(projectRoot, DEFAULT_BUILD_DIR);

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
	await ensureBuildManifestExcludesRoutePrefix(buildDirectory, '/demo');

	process.stdout.write(`Validated adapter-node build output at ${buildDirectory}\n`);
} finally {
	await rm(generatedSourceDirectory, { force: true, recursive: true });
}
