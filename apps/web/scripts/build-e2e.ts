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

// The e2e build keeps the /demo routes and runs on workerd through `wrangler dev`.
await validateCloudflareBuild(projectRoot, {
	requireDemoExclusion: false,
	requireGsapBundled: false
});

process.stdout.write('Prepared the e2e worker under .svelte-kit/cloudflare\n');
