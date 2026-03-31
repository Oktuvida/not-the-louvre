import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ensureBuildManifestExcludesRoutePrefix,
	ensureBuildOutput,
	ensureServerDependencyBundled,
	syncProductionRoutes
} from './build';

describe('ensureBuildOutput', () => {
	it('returns the adapter-node entrypoint when build artifacts exist', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		await mkdir(buildDir, { recursive: true });
		await writeFile(join(buildDir, 'index.js'), 'console.log("ok")');
		await writeFile(join(buildDir, 'handler.js'), 'export const handler = () => {}');

		await expect(ensureBuildOutput(buildDir)).resolves.toBe(join(buildDir, 'index.js'));
	});

	it('throws when the build directory is missing the node entrypoint', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		await mkdir(buildDir, { recursive: true });
		await writeFile(join(buildDir, 'handler.js'), 'export const handler = () => {}');

		await expect(ensureBuildOutput(buildDir)).rejects.toThrow(
			'Expected adapter-node build output at'
		);
	});

	it('throws when a server bundle still imports gsap at runtime', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server', 'chunks');
		await mkdir(serverDir, { recursive: true });
		await writeFile(join(buildDir, 'index.js'), 'console.log("ok")');
		await writeFile(join(buildDir, 'handler.js'), 'export const handler = () => {}');
		await writeFile(join(serverDir, '_page.js'), "import gsap from 'gsap';\nexport default gsap;");

		await expect(ensureServerDependencyBundled(buildDir, 'gsap')).rejects.toThrow(
			'Expected SSR build to bundle gsap'
		);
	});

	it('passes when the server bundle does not import gsap at runtime', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server', 'chunks');
		await mkdir(serverDir, { recursive: true });
		await writeFile(join(buildDir, 'index.js'), 'console.log("ok")');
		await writeFile(join(buildDir, 'handler.js'), 'export const handler = () => {}');
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
