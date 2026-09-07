import { mkdir, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { syncProductionRoutes, validateCloudflareBuild } from '../src/lib/server/deploy/build';

const projectRoot = process.cwd();
const bunExecutablePath = process.execPath;
const sourceRoutesDirectory = resolve(projectRoot, 'src/routes');
const generatedSourceDirectory = resolve(projectRoot, '.generated/production-src');
const targetRoutesDirectory = resolve(generatedSourceDirectory, 'routes');
const generatedLibDirectory = resolve(generatedSourceDirectory, 'lib');
const sourceLibDirectory = resolve(projectRoot, 'src/lib');

try {
	await rm(generatedSourceDirectory, { force: true, recursive: true });
	await mkdir(generatedSourceDirectory, { recursive: true });
	await symlink(sourceLibDirectory, generatedLibDirectory, 'dir');
	await syncProductionRoutes(sourceRoutesDirectory, targetRoutesDirectory, ['demo']);
	process.stdout.write(`Prepared production routes at ${targetRoutesDirectory}\n`);

	const svelteKitSync = Bun.spawn([bunExecutablePath, 'run', 'prepare'], {
		cwd: projectRoot,
		stderr: 'inherit',
		stdout: 'inherit'
	});

	if ((await svelteKitSync.exited) !== 0) {
		throw new Error('svelte-kit sync failed before production build');
	}

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

	const cloudflareBuildDirectory = await validateCloudflareBuild(projectRoot);

	process.stdout.write(
		`Validated adapter-cloudflare build output at ${cloudflareBuildDirectory}\n`
	);
} finally {
	await rm(generatedSourceDirectory, { force: true, recursive: true });
}
