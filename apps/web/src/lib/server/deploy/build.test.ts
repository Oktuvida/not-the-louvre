import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ensureServerWasmAsset,
	ensureServerWasmReferenced,
	ensureBuildManifestExcludesRoutePrefix,
	ensureBuildOutput,
	ensureServerDependencyBundled,
	syncGeneratedServerWasmAsset,
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

	it('throws when a server bundle still imports the stroke-json runtime package at runtime', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server', 'chunks');
		await mkdir(serverDir, { recursive: true });
		await writeFile(join(buildDir, 'index.js'), 'console.log("ok")');
		await writeFile(join(buildDir, 'handler.js'), 'export const handler = () => {}');
		await writeFile(
			join(serverDir, '_runtime.js'),
			"import { createServerStrokeJsonRuntime } from '@not-the-louvre/stroke-json-runtime/server';\nexport default createServerStrokeJsonRuntime;"
		);

		await expect(
			ensureServerDependencyBundled(buildDir, '@not-the-louvre/stroke-json-runtime/server')
		).rejects.toThrow('Expected SSR build to bundle @not-the-louvre/stroke-json-runtime/server');
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

	it('copies the generated server wasm asset into the built server output', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const generatedWasmPath = join(tmpdir(), `ntl-wasm-${crypto.randomUUID()}.wasm`);
		await mkdir(join(buildDir, 'server'), { recursive: true });
		await writeFile(generatedWasmPath, new Uint8Array([0x00, 0x61, 0x73, 0x6d]));

		const copiedAssetPath = await syncGeneratedServerWasmAsset(buildDir, generatedWasmPath);

		await expect(readFile(copiedAssetPath)).resolves.toEqual(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
	});

	it('throws when the built server runtime wasm asset is missing', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		await mkdir(join(buildDir, 'server'), { recursive: true });

		await expect(ensureServerWasmAsset(buildDir)).rejects.toThrow(
			'Expected built server runtime wasm asset at'
		);
	});

	it('passes when the built server runtime wasm asset exists', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const wasmPath = join(buildDir, 'server', 'generated', 'wasm', 'server');
		await mkdir(wasmPath, { recursive: true });
		await writeFile(join(wasmPath, 'stroke_json_wasm_bg.wasm'), new Uint8Array([0x00, 0x61]));

		await expect(ensureServerWasmAsset(buildDir)).resolves.toContain('stroke_json_wasm_bg.wasm');
	});

	it('throws when the built server bundle never references the emitted wasm asset', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server', 'chunks');
		await mkdir(serverDir, { recursive: true });
		await writeFile(join(serverDir, '_page.js'), 'export const noop = true;');

		await expect(ensureServerWasmReferenced(buildDir)).rejects.toThrow(
			'Expected SSR build to reference stroke_json_wasm_bg.wasm'
		);
	});

	it('passes when the built server bundle references the emitted wasm asset', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		const serverDir = join(buildDir, 'server', 'chunks');
		await mkdir(serverDir, { recursive: true });
		await writeFile(
			join(serverDir, '_runtime.js'),
			"const wasmUrl = new URL('../generated/wasm/server/stroke_json_wasm_bg.wasm', import.meta.url);\nexport { wasmUrl };"
		);

		await expect(ensureServerWasmReferenced(buildDir)).resolves.toContain('_runtime.js');
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
