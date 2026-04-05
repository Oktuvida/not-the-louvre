import { readFile } from 'node:fs/promises';
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

const loadDefaultServerBindings = async (): Promise<StrokeJsonBindings> => {
	const wasmUrl = new URL('../generated/wasm/server/stroke_json_wasm_bg.wasm', import.meta.url);
	const wasmBytes = new Uint8Array(await readFile(wasmUrl));

	if (typeof initSync === 'function') {
		initSync({ module: wasmBytes });
	} else {
		await initStrokeJsonServerWasm({ module_or_path: wasmBytes });
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