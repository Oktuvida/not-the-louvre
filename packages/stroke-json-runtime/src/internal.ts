export type StrokeJsonRuntimeErrorCode =
	| 'document_limits_exceeded'
	| 'init_failed'
	| 'internal_error'
	| 'invalid_document'
	| 'invalid_options'
	| 'invalid_payload';

export class StrokeJsonRuntimeError extends Error {
	public readonly code: StrokeJsonRuntimeErrorCode;
	public override readonly cause?: unknown;

	constructor(code: StrokeJsonRuntimeErrorCode, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'StrokeJsonRuntimeError';
		this.code = code;
		this.cause = options?.cause;
	}
}

type Disposable = {
	free?: () => void;
};

type StrokeJsonPreparedStorageBindingsResult = Disposable & {
	canonical_json: Uint8Array;
	compressed_bytes: Uint8Array;
	height: number;
	kind: string;
	stroke_count: number;
	total_points: number;
	version: number;
	width: number;
};

type StrokeJsonPreparedPublishBindingsResult = Disposable & {
	document_json: Uint8Array;
	height: number;
	kind: string;
	largest_skipped_stroke_coverage_pixels: number;
	max_stroke_coverage_pixels?: number | null;
	protected_tail_point_count: number;
	protected_tail_stroke_count: number;
	skipped_partial_compaction_stroke_count: number;
	stroke_count: number;
	total_points: number;
	version: number;
	width: number;
};

type StrokeJsonPreparedLosslessBindingsResult = Disposable & {
	document_json: Uint8Array;
	height: number;
	kind: string;
	largest_skipped_stroke_coverage_pixels: number;
	max_stroke_coverage_pixels?: number | null;
	skipped_partial_compaction_stroke_count: number;
	stroke_count: number;
	total_points: number;
	version: number;
	width: number;
};

type StrokeJsonPreparedProdLikeIterationBindingsResult = Disposable & {
	document_json: Uint8Array;
	duration_ms: number;
	gzip_bytes: number;
	pass_number: number;
	raw_bytes: number;
	stroke_count: number;
	total_points: number;
};

type StrokeJsonPreparedProdLikeBindingsResult = Disposable & {
	final_document_json: Uint8Array;
	height: number;
	iterations: Array<StrokeJsonPreparedProdLikeIterationBindingsResult>;
	kind: string;
	stroke_count: number;
	total_duration_ms: number;
	total_points: number;
	version: number;
	width: number;
};

type StrokeJsonDocumentMetadataBindingsResult = Disposable & {
	height: number;
	kind: string;
	stroke_count: number;
	total_points: number;
	version: number;
	width: number;
};

export type StrokeJsonBindings = {
	compact_document_losslessly_with_report: (
		documentJson: Uint8Array,
		optionsJson?: string | null
	) => StrokeJsonPreparedLosslessBindingsResult;
	decode_canonical_document: (payload: Uint8Array) => Uint8Array;
	decode_editable_document: (payload: Uint8Array) => Uint8Array;
	normalize_editable_document: (documentJson: Uint8Array) => Uint8Array;
	prepare_publish_document: (
		documentJson: Uint8Array,
		optionsJson?: string | null
	) => StrokeJsonPreparedPublishBindingsResult;
	prepare_storage_document: (documentJson: Uint8Array) => StrokeJsonPreparedStorageBindingsResult;
	run_prod_like_pipeline: (
		documentJson: Uint8Array,
		optionsJson?: string | null
	) => StrokeJsonPreparedProdLikeBindingsResult;
	serialize_canonical_document: (documentJson: Uint8Array) => Uint8Array;
	stroke_json_wasm_version: () => string;
	validate_document: (documentJson: Uint8Array) => StrokeJsonDocumentMetadataBindingsResult;
};

export type StrokeJsonDocumentMetadata = {
	height: number;
	kind: string;
	strokeCount: number;
	totalPoints: number;
	version: number;
	width: number;
};

export type StrokeJsonStorageDocument = StrokeJsonDocumentMetadata & {
	canonicalDocumentJson: string;
	compressedDocumentBase64: string;
};

export type StrokeJsonPublishOptions = {
	maxStrokeCoveragePixels?: number | null;
	minTailPoints?: number;
	rasterGuardPresetId?: string;
};

export type StrokeJsonPreparedPublishDocument = StrokeJsonDocumentMetadata & {
	documentJson: string;
	largestSkippedStrokeCoveragePixels: number;
	maxStrokeCoveragePixels: number | null;
	protectedTailPointCount: number;
	protectedTailStrokeCount: number;
	skippedPartialCompactionStrokeCount: number;
};

export type StrokeJsonLosslessCompactionOptions = {
	maxStrokeCoveragePixels?: number | null;
};

export type StrokeJsonPreparedLosslessCompactionDocument = StrokeJsonDocumentMetadata & {
	documentJson: string;
	largestSkippedStrokeCoveragePixels: number;
	maxStrokeCoveragePixels: number | null;
	skippedPartialCompactionStrokeCount: number;
};

export type StrokeJsonProdLikePipelineOptions = {
	iterationCount?: number;
	phase2MaxStrokeCoveragePixels?: number | null;
};

export type StrokeJsonPreparedProdLikePipelineIteration = {
	documentJson: string;
	durationMs: number;
	gzipBytes: number;
	passNumber: number;
	rawBytes: number;
	strokeCount: number;
	totalPoints: number;
};

export type StrokeJsonPreparedProdLikePipelineDocument = StrokeJsonDocumentMetadata & {
	finalDocumentJson: string;
	iterations: StrokeJsonPreparedProdLikePipelineIteration[];
	totalDurationMs: number;
};

export type StrokeJsonRuntime = {
	compactDocumentLosslesslyWithReport: (
		documentJson: string,
		options?: StrokeJsonLosslessCompactionOptions
	) => Promise<StrokeJsonPreparedLosslessCompactionDocument>;
	decodeCanonicalDocument: (payloadBase64: string) => Promise<string>;
	decodeEditableDocument: (payloadBase64: string) => Promise<string>;
	getVersion: () => Promise<string>;
	normalizeEditableDocument: (documentJson: string) => Promise<string>;
	preparePublishDocument: (
		documentJson: string,
		options?: StrokeJsonPublishOptions
	) => Promise<StrokeJsonPreparedPublishDocument>;
	prepareStorageDocument: (documentJson: string) => Promise<StrokeJsonStorageDocument>;
	runProdLikePipeline: (
		documentJson: string,
		options?: StrokeJsonProdLikePipelineOptions
	) => Promise<StrokeJsonPreparedProdLikePipelineDocument>;
	serializeCanonicalDocument: (documentJson: string) => Promise<string>;
	validateDocument: (documentJson: string) => Promise<StrokeJsonDocumentMetadata>;
};

export type StrokeJsonRuntimeLoader = () => Promise<StrokeJsonBindings>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toUtf8Bytes = (value: string) => textEncoder.encode(value);
const fromUtf8Bytes = (value: Uint8Array) => textDecoder.decode(value);

const encodeBase64 = (value: Uint8Array) => {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(value).toString('base64');
	}

	let binary = '';
	for (const byte of value) {
		binary += String.fromCharCode(byte);
	}

	return globalThis.btoa(binary);
};

const decodeBase64 = (value: string) => {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(value, 'base64'));
	}

	const binary = globalThis.atob(value);
	const decoded = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		decoded[index] = binary.charCodeAt(index);
	}

	return decoded;
};

const normalizeErrorMessage = (error: unknown) => {
	if (error instanceof StrokeJsonRuntimeError) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
};

const inferErrorCode = (message: string): StrokeJsonRuntimeErrorCode => {
	if (
		message.startsWith('Invalid drawing document') ||
		message.startsWith('Invalid drawing document JSON')
	) {
		return 'invalid_document';
	}

	if (message.startsWith('Drawing document exceeds')) {
		return 'document_limits_exceeded';
	}

	if (message.startsWith('Failed to decompress drawing document')) {
		return 'invalid_payload';
	}

	if (message.startsWith('Invalid stroke-json options JSON')) {
		return 'invalid_options';
	}

	return 'internal_error';
};

export const toStrokeJsonRuntimeError = (
	error: unknown,
	defaultCode: StrokeJsonRuntimeErrorCode = 'internal_error'
) => {
	if (error instanceof StrokeJsonRuntimeError) {
		return error;
	}

	const message = normalizeErrorMessage(error);
	const code = defaultCode === 'internal_error' ? inferErrorCode(message) : defaultCode;
	return new StrokeJsonRuntimeError(code, message, { cause: error });
};

const withDisposableValue = <T extends Disposable, TResult>(
	value: T,
	map: (result: T) => TResult
) => {
	try {
		return map(value);
	} finally {
		value.free?.();
	}
};

const toDocumentMetadata = (
	metadata: StrokeJsonDocumentMetadataBindingsResult
): StrokeJsonDocumentMetadata => ({
	height: metadata.height,
	kind: metadata.kind,
	strokeCount: metadata.stroke_count,
	totalPoints: metadata.total_points,
	version: metadata.version,
	width: metadata.width
});

const toStorageDocument = (
	prepared: StrokeJsonPreparedStorageBindingsResult
): StrokeJsonStorageDocument => ({
	canonicalDocumentJson: fromUtf8Bytes(prepared.canonical_json),
	compressedDocumentBase64: encodeBase64(prepared.compressed_bytes),
	height: prepared.height,
	kind: prepared.kind,
	strokeCount: prepared.stroke_count,
	totalPoints: prepared.total_points,
	version: prepared.version,
	width: prepared.width
});

const toPreparedPublishDocument = (
	prepared: StrokeJsonPreparedPublishBindingsResult
): StrokeJsonPreparedPublishDocument => ({
	documentJson: fromUtf8Bytes(prepared.document_json),
	height: prepared.height,
	kind: prepared.kind,
	largestSkippedStrokeCoveragePixels: prepared.largest_skipped_stroke_coverage_pixels,
	maxStrokeCoveragePixels: prepared.max_stroke_coverage_pixels ?? null,
	protectedTailPointCount: prepared.protected_tail_point_count,
	protectedTailStrokeCount: prepared.protected_tail_stroke_count,
	skippedPartialCompactionStrokeCount: prepared.skipped_partial_compaction_stroke_count,
	strokeCount: prepared.stroke_count,
	totalPoints: prepared.total_points,
	version: prepared.version,
	width: prepared.width
});

const toPreparedLosslessCompactionDocument = (
	prepared: StrokeJsonPreparedLosslessBindingsResult
): StrokeJsonPreparedLosslessCompactionDocument => ({
	documentJson: fromUtf8Bytes(prepared.document_json),
	height: prepared.height,
	kind: prepared.kind,
	largestSkippedStrokeCoveragePixels: prepared.largest_skipped_stroke_coverage_pixels,
	maxStrokeCoveragePixels: prepared.max_stroke_coverage_pixels ?? null,
	skippedPartialCompactionStrokeCount: prepared.skipped_partial_compaction_stroke_count,
	strokeCount: prepared.stroke_count,
	totalPoints: prepared.total_points,
	version: prepared.version,
	width: prepared.width
});

const toPreparedProdLikeDocument = (
	prepared: StrokeJsonPreparedProdLikeBindingsResult
): StrokeJsonPreparedProdLikePipelineDocument => {
	const iterations = prepared.iterations.map((iteration) => {
		try {
			return {
				documentJson: fromUtf8Bytes(iteration.document_json),
				durationMs: iteration.duration_ms,
				gzipBytes: iteration.gzip_bytes,
				passNumber: iteration.pass_number,
				rawBytes: iteration.raw_bytes,
				strokeCount: iteration.stroke_count,
				totalPoints: iteration.total_points
			};
		} finally {
			iteration.free?.();
		}
	});

	return {
		finalDocumentJson: fromUtf8Bytes(prepared.final_document_json),
		height: prepared.height,
		iterations,
		kind: prepared.kind,
		strokeCount: prepared.stroke_count,
		totalDurationMs: prepared.total_duration_ms,
		totalPoints: prepared.total_points,
		version: prepared.version,
		width: prepared.width
	};
};

const stringifyOptions = (options: Record<string, unknown> | undefined) =>
	options === undefined ? null : JSON.stringify(options);

export const createStrokeJsonRuntime = (
	loadBindings: StrokeJsonRuntimeLoader
): StrokeJsonRuntime => {
	let bindingsPromise: Promise<StrokeJsonBindings> | null = null;

	const getBindings = async () => {
		if (!bindingsPromise) {
			bindingsPromise = loadBindings().catch((error) => {
				throw toStrokeJsonRuntimeError(error, 'init_failed');
			});
		}

		return bindingsPromise;
	};

	const call = async <TResult>(
		operation: (bindings: StrokeJsonBindings) => TResult | Promise<TResult>
	): Promise<TResult> => {
		let bindings: StrokeJsonBindings;

		try {
			bindings = await getBindings();
		} catch (error) {
			throw toStrokeJsonRuntimeError(error, 'init_failed');
		}

		try {
			return await operation(bindings);
		} catch (error) {
			throw toStrokeJsonRuntimeError(error);
		}
	};

	return {
		compactDocumentLosslesslyWithReport: (documentJson, options) =>
			call((bindings) =>
				withDisposableValue(
					bindings.compact_document_losslessly_with_report(
						toUtf8Bytes(documentJson),
						stringifyOptions(options)
					),
					toPreparedLosslessCompactionDocument
				)
			),
		decodeCanonicalDocument: (payloadBase64) =>
			call((bindings) => fromUtf8Bytes(bindings.decode_canonical_document(decodeBase64(payloadBase64)))),
		decodeEditableDocument: (payloadBase64) =>
			call((bindings) => fromUtf8Bytes(bindings.decode_editable_document(decodeBase64(payloadBase64)))),
		getVersion: () => call((bindings) => bindings.stroke_json_wasm_version()),
		normalizeEditableDocument: (documentJson) =>
			call((bindings) => fromUtf8Bytes(bindings.normalize_editable_document(toUtf8Bytes(documentJson)))),
		preparePublishDocument: (documentJson, options) =>
			call((bindings) =>
				withDisposableValue(
					bindings.prepare_publish_document(toUtf8Bytes(documentJson), stringifyOptions(options)),
					toPreparedPublishDocument
				)
			),
		prepareStorageDocument: (documentJson) =>
			call((bindings) =>
				withDisposableValue(
					bindings.prepare_storage_document(toUtf8Bytes(documentJson)),
					toStorageDocument
				)
			),
		runProdLikePipeline: (documentJson, options) =>
			call((bindings) =>
				withDisposableValue(
					bindings.run_prod_like_pipeline(toUtf8Bytes(documentJson), stringifyOptions(options)),
					toPreparedProdLikeDocument
				)
			),
		serializeCanonicalDocument: (documentJson) =>
			call((bindings) => fromUtf8Bytes(bindings.serialize_canonical_document(toUtf8Bytes(documentJson)))),
		validateDocument: (documentJson) =>
			call((bindings) =>
				withDisposableValue(
					bindings.validate_document(toUtf8Bytes(documentJson)),
					toDocumentMetadata
				)
			)
	};
};