import initStrokeJsonServerWasm, {
	compact_document_losslessly_with_report,
	decode_canonical_document,
	decode_editable_document,
	initSync,
	normalize_editable_document,
	prepare_publish_document,
	prepare_storage_document,
	run_prod_like_pipeline,
	serialize_canonical_document,
	stroke_json_wasm_version,
	validate_document
} from '../generated/wasm/server/stroke_json_wasm.js';
import {
	createStrokeJsonRuntime,
	type StrokeJsonBindings,
	type StrokeJsonRuntime,
	type StrokeJsonRuntimeLoader,
	StrokeJsonRuntimeError,
	type StrokeJsonDocumentMetadata,
	type StrokeJsonLosslessCompactionOptions,
	type StrokeJsonPreparedLosslessCompactionDocument,
	type StrokeJsonPreparedProdLikePipelineDocument,
	type StrokeJsonPreparedProdLikePipelineIteration,
	type StrokeJsonPreparedPublishDocument,
	type StrokeJsonProdLikePipelineOptions,
	type StrokeJsonPublishOptions,
	type StrokeJsonRuntimeErrorCode,
	type StrokeJsonStorageDocument,
	toStrokeJsonRuntimeError
} from './internal';

// Cloudflare Workers forbid compiling WASM from bytes at runtime, so there the
// binary must arrive as a WebAssembly.Module import resolved by the bundler.
const runningInCloudflareWorkers =
	typeof caches !== 'undefined' &&
	(caches as unknown as { default?: unknown }).default !== undefined;

const loadServerWasmModule = async (): Promise<WebAssembly.Module | Uint8Array> => {
	if (runningInCloudflareWorkers) {
		const { default: wasmModule } = (await import(
			'@not-the-louvre/stroke-json-runtime/server.wasm'
		)) as unknown as { default: WebAssembly.Module };

		return wasmModule;
	}

	const { readFile } = await import('node:fs/promises');
	const wasmUrl = new URL('../generated/wasm/server/stroke_json_wasm_bg.wasm', import.meta.url);

	return new Uint8Array(await readFile(wasmUrl));
};

const loadDefaultServerBindings = async (): Promise<StrokeJsonBindings> => {
	const wasmModule = await loadServerWasmModule();

	if (typeof initSync === 'function') {
		initSync({ module: wasmModule });
	} else {
		await initStrokeJsonServerWasm({ module_or_path: wasmModule });
	}

	return {
		compact_document_losslessly_with_report,
		decode_canonical_document,
		decode_editable_document,
		normalize_editable_document,
		prepare_publish_document,
		prepare_storage_document,
		run_prod_like_pipeline,
		serialize_canonical_document,
		stroke_json_wasm_version,
		validate_document
	};
};

export type {
	StrokeJsonBindings,
	StrokeJsonDocumentMetadata,
	StrokeJsonLosslessCompactionOptions,
	StrokeJsonPreparedLosslessCompactionDocument,
	StrokeJsonPreparedProdLikePipelineDocument,
	StrokeJsonPreparedProdLikePipelineIteration,
	StrokeJsonPreparedPublishDocument,
	StrokeJsonProdLikePipelineOptions,
	StrokeJsonPublishOptions,
	StrokeJsonRuntime,
	StrokeJsonRuntimeErrorCode,
	StrokeJsonRuntimeLoader,
	StrokeJsonStorageDocument
};
export { StrokeJsonRuntimeError, toStrokeJsonRuntimeError };

export const createServerStrokeJsonRuntime = (options: {
	loadBindings?: StrokeJsonRuntimeLoader;
} = {}): StrokeJsonRuntime => createStrokeJsonRuntime(options.loadBindings ?? loadDefaultServerBindings);