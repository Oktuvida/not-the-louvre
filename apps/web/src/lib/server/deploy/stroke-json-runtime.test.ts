import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ensureGeneratedWasmArtifacts,
	initializeGeneratedServerRuntime
} from './stroke-json-runtime';

describe('ensureGeneratedWasmArtifacts', () => {
	it('passes when browser and server generated outputs contain the required files', async () => {
		const generatedDir = join(tmpdir(), `ntl-stroke-json-generated-${crypto.randomUUID()}`);

		for (const runtimeTarget of ['browser', 'server']) {
			const runtimeDir = join(generatedDir, runtimeTarget);
			await mkdir(runtimeDir, { recursive: true });
			await Promise.all([
				writeFile(join(runtimeDir, 'package.json'), '{}'),
				writeFile(
					join(runtimeDir, 'stroke_json_wasm.js'),
					'export default async function init() {}'
				),
				writeFile(join(runtimeDir, 'stroke_json_wasm.d.ts'), 'export {};'),
				writeFile(
					join(runtimeDir, 'stroke_json_wasm_bg.wasm'),
					new Uint8Array([0x00, 0x61, 0x73, 0x6d])
				),
				writeFile(join(runtimeDir, 'stroke_json_wasm_bg.wasm.d.ts'), 'export {};')
			]);
		}

		await expect(ensureGeneratedWasmArtifacts(generatedDir)).resolves.toBeUndefined();
	});

	it('throws when a generated runtime target is missing a required artifact', async () => {
		const generatedDir = join(tmpdir(), `ntl-stroke-json-generated-${crypto.randomUUID()}`);
		const browserDir = join(generatedDir, 'browser');
		const serverDir = join(generatedDir, 'server');
		await mkdir(browserDir, { recursive: true });
		await mkdir(serverDir, { recursive: true });

		await Promise.all([
			writeFile(join(browserDir, 'package.json'), '{}'),
			writeFile(join(serverDir, 'package.json'), '{}')
		]);

		await expect(ensureGeneratedWasmArtifacts(generatedDir)).rejects.toThrow(
			'Missing generated stroke-json runtime artifact'
		);
	});
});

describe('initializeGeneratedServerRuntime', () => {
	it('loads the generated server runtime from disk and returns its version string', async () => {
		const serverRuntimeDirectory = resolve(
			process.cwd(),
			'../../packages/stroke-json-runtime/generated/wasm/server'
		);

		await expect(initializeGeneratedServerRuntime(serverRuntimeDirectory)).resolves.toMatch(
			/^\d+\.\d+\.\d+/
		);
	});
});
