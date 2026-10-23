import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ensureBuildManifestExcludesRoutePrefix,
	ensureServerDependencyBundled,
	ensureWorkerBuildOutput,
	syncProductionRoutes,
	validateCloudflareBuild
} from './build';

describe('server bundle assertions', () => {
	it('throws when a server bundle still imports gsap at runtime', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server', 'chunks');
		await mkdir(serverDir, { recursive: true });
		await writeFile(join(serverDir, '_page.js'), "import gsap from 'gsap';\nexport default gsap;");

		await expect(ensureServerDependencyBundled(buildDir, 'gsap')).rejects.toThrow(
			'Expected SSR build to bundle gsap'
		);
	});

	it('passes when the server bundle does not import gsap at runtime', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server', 'chunks');
		await mkdir(serverDir, { recursive: true });
		await writeFile(
			join(serverDir, '_page.js'),
			'const animation = { to: () => {} };\nexport default animation;'
		);

		await expect(ensureServerDependencyBundled(buildDir, 'gsap')).resolves.toBeUndefined();
	});

	it('throws when the production manifest still includes the demo route prefix', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server');
		await mkdir(serverDir, { recursive: true });
		await writeFile(
			join(serverDir, 'manifest.js'),
			'export const manifest = { routes: [{ id: "/demo" }, { id: "/gallery" }] };'
		);

		await expect(ensureBuildManifestExcludesRoutePrefix(buildDir, '/demo')).rejects.toThrow(
			'Expected production build manifest to exclude routes under /demo'
		);
	});

	it('passes when the production manifest excludes the demo route prefix', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server');
		await mkdir(serverDir, { recursive: true });
		await writeFile(
			join(serverDir, 'manifest.js'),
			'export const manifest = { routes: [{ id: "/gallery" }] };'
		);

		await expect(
			ensureBuildManifestExcludesRoutePrefix(buildDir, '/demo')
		).resolves.toBeUndefined();
	});
});

describe('ensureWorkerBuildOutput', () => {
	it('returns the worker entrypoint when the adapter-cloudflare output exists', async () => {
		const buildDir = join(tmpdir(), `ntl-cf-build-${crypto.randomUUID()}`);
		await mkdir(buildDir, { recursive: true });
		await writeFile(join(buildDir, '_worker.js'), 'export default { fetch: () => {} };');

		await expect(ensureWorkerBuildOutput(buildDir)).resolves.toBe(join(buildDir, '_worker.js'));
	});

	it('throws when the worker entrypoint is missing', async () => {
		const buildDir = join(tmpdir(), `ntl-cf-build-${crypto.randomUUID()}`);
		await mkdir(buildDir, { recursive: true });

		await expect(ensureWorkerBuildOutput(buildDir)).rejects.toThrow(
			'Expected adapter-cloudflare build output at'
		);
	});
});

describe('syncProductionRoutes', () => {
	it('copies routes while excluding the demo tree', async () => {
		const sourceDir = join(tmpdir(), `ntl-routes-source-${crypto.randomUUID()}`);
		const targetDir = join(tmpdir(), `ntl-routes-target-${crypto.randomUUID()}`);
		await mkdir(join(sourceDir, 'demo', 'playwright'), { recursive: true });
		await mkdir(join(sourceDir, 'gallery'), { recursive: true });
		await writeFile(join(sourceDir, '+page.svelte'), '<h1>Home</h1>');
		await writeFile(join(sourceDir, 'demo', '+page.svelte'), '<h1>Demo</h1>');
		await writeFile(join(sourceDir, 'demo', 'playwright', '+page.svelte'), '<h1>Playwright</h1>');
		await writeFile(join(sourceDir, 'gallery', '+page.svelte'), '<h1>Gallery</h1>');

		await syncProductionRoutes(sourceDir, targetDir, ['demo']);

		await expect(readFile(join(targetDir, '+page.svelte'), 'utf8')).resolves.toContain('Home');
		await expect(readFile(join(targetDir, 'gallery', '+page.svelte'), 'utf8')).resolves.toContain(
			'Gallery'
		);
		await expect(access(join(targetDir, 'demo', '+page.svelte'))).rejects.toThrow();
	});
});

describe('validateCloudflareBuild', () => {
	const createBuildTree = async ({
		demoRouteInManifest = false,
		gsapRuntimeImport = false,
		workerOutput = true
	} = {}) => {
		const projectRoot = join(tmpdir(), `ntl-validate-${crypto.randomUUID()}`);
		const cloudflareDir = join(projectRoot, '.svelte-kit', 'cloudflare');
		const cloudflareTmpDir = join(projectRoot, '.svelte-kit', 'cloudflare-tmp');
		const serverChunksDir = join(projectRoot, '.svelte-kit', 'output', 'server', 'chunks');

		await mkdir(cloudflareTmpDir, { recursive: true });
		await mkdir(serverChunksDir, { recursive: true });
		await mkdir(cloudflareDir, { recursive: true });

		if (workerOutput) {
			await writeFile(join(cloudflareDir, '_worker.js'), 'export default { fetch: () => {} };');
		}

		await writeFile(
			join(cloudflareTmpDir, 'manifest.js'),
			demoRouteInManifest
				? 'export const manifest = { routes: [{ id: "/demo" }, { id: "/gallery" }] };'
				: 'export const manifest = { routes: [{ id: "/gallery" }] };'
		);

		if (gsapRuntimeImport) {
			await writeFile(
				join(serverChunksDir, '_page.js'),
				"import gsap from 'gsap';\nexport default gsap;"
			);
		}

		return { projectRoot };
	};

	it('validates the production contract', async () => {
		const { projectRoot } = await createBuildTree();

		await expect(validateCloudflareBuild(projectRoot)).resolves.toBe(
			join(projectRoot, '.svelte-kit', 'cloudflare')
		);
	});

	it('throws when the worker entrypoint is missing', async () => {
		const { projectRoot } = await createBuildTree({ workerOutput: false });

		await expect(validateCloudflareBuild(projectRoot)).rejects.toThrow(
			'Expected adapter-cloudflare build output at'
		);
	});

	it('throws when the production manifest still contains the demo routes', async () => {
		const { projectRoot } = await createBuildTree({
			demoRouteInManifest: true
		});

		await expect(validateCloudflareBuild(projectRoot)).rejects.toThrow(
			'Expected production build manifest to exclude routes under /demo'
		);
	});

	it('skips the worker-only assertions when the e2e flags disable them', async () => {
		const { projectRoot } = await createBuildTree({
			demoRouteInManifest: true,
			gsapRuntimeImport: true,
			workerOutput: false
		});

		await expect(
			validateCloudflareBuild(projectRoot, {
				requireDemoExclusion: false,
				requireGsapBundled: false,
				requireWorkerOutput: false
			})
		).resolves.toBe(join(projectRoot, '.svelte-kit', 'cloudflare'));
	});
});
