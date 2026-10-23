import process from 'node:process';
import { validateCloudflareBuild } from '../src/lib/server/deploy/build';

const projectRoot = process.cwd();
const bunExecutablePath = process.execPath;

const svelteKitSync = Bun.spawn([bunExecutablePath, 'run', 'prepare'], {
	cwd: projectRoot,
	stderr: 'inherit',
	stdout: 'inherit'
});

if ((await svelteKitSync.exited) !== 0) {
	throw new Error('svelte-kit sync failed before e2e build');
}

const viteBuild = Bun.spawn(['vite', 'build'], {
	cwd: projectRoot,
	stderr: 'inherit',
	stdout: 'inherit'
});

const exitCode = await viteBuild.exited;

if (exitCode !== 0) {
	throw new Error(`vite build failed with exit code ${exitCode}`);
}

// The e2e build keeps the /demo routes and is served by Node through
// `vite preview`, so the Worker-only assertions do not apply here.
await validateCloudflareBuild(projectRoot, {
	requireDemoExclusion: false,
	requireGsapBundled: false,
	requireWorkerOutput: false
});

process.stdout.write('Prepared e2e server runtime assets under .svelte-kit/output\n');
