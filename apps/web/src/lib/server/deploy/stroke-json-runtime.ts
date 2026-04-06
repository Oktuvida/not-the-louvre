import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const GENERATED_RUNTIME_TARGETS = ['browser', 'server'] as const;
const REQUIRED_GENERATED_RUNTIME_FILES = [
	'package.json',
	'stroke_json_wasm.js',
	'stroke_json_wasm.d.ts',
	'stroke_json_wasm_bg.wasm',
	'stroke_json_wasm_bg.wasm.d.ts'
] as const;

type GeneratedRuntimeModule = {
	default?: (input?: BufferSource | WebAssembly.Module) => Promise<unknown>;
	initSync?: (input?: BufferSource | WebAssembly.Module) => unknown;
	stroke_json_wasm_version?: () => string;
};

const ensureRequiredFiles = async (runtimeDirectory: string) => {
	for (const fileName of REQUIRED_GENERATED_RUNTIME_FILES) {
		const filePath = join(runtimeDirectory, fileName);

		try {
			await access(filePath);
		} catch {
			throw new Error(`Missing generated stroke-json runtime artifact: ${filePath}`);
		}
	}
};

export const ensureGeneratedWasmArtifacts = async (generatedWasmDirectory: string) => {
	for (const runtimeTarget of GENERATED_RUNTIME_TARGETS) {
		await ensureRequiredFiles(join(generatedWasmDirectory, runtimeTarget));
	}
};

export const initializeGeneratedServerRuntime = async (serverRuntimeDirectory: string) => {
	await ensureRequiredFiles(serverRuntimeDirectory);

	const runtimeModulePath = join(serverRuntimeDirectory, 'stroke_json_wasm.js');
	const runtimeWasmPath = join(serverRuntimeDirectory, 'stroke_json_wasm_bg.wasm');
	const runtimeModule = (await import(
		pathToFileURL(runtimeModulePath).href
	)) as GeneratedRuntimeModule;
	const runtimeWasmBytes = await readFile(runtimeWasmPath);

	if (typeof runtimeModule.initSync === 'function') {
		runtimeModule.initSync({ module: runtimeWasmBytes });
	} else if (typeof runtimeModule.default === 'function') {
		await runtimeModule.default({ module_or_path: runtimeWasmBytes });
	} else {
		throw new Error(
			`Generated server runtime does not expose an initialization entrypoint: ${runtimeModulePath}`
		);
	}

	if (typeof runtimeModule.stroke_json_wasm_version !== 'function') {
		throw new Error(
			`Generated server runtime does not expose stroke_json_wasm_version: ${runtimeModulePath}`
		);
	}

	return runtimeModule.stroke_json_wasm_version();
};
