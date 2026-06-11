/* tslint:disable */
/* eslint-disable */

export class StrokeJsonDocumentMetadata {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    height: number;
    kind: string;
    stroke_count: number;
    total_points: number;
    version: number;
    width: number;
}

export class StrokeJsonPreparedLosslessCompactionDocument {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    document_json: Uint8Array;
    height: number;
    kind: string;
    largest_skipped_stroke_coverage_pixels: number;
    get max_stroke_coverage_pixels(): number | undefined;
    set max_stroke_coverage_pixels(value: number | null | undefined);
    skipped_partial_compaction_stroke_count: number;
    stroke_count: number;
    total_points: number;
    version: number;
    width: number;
}

export class StrokeJsonPreparedProdLikePipelineDocument {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    final_document_json: Uint8Array;
    height: number;
    iterations: Array<any>;
    kind: string;
    stroke_count: number;
    total_duration_ms: number;
    total_points: number;
    version: number;
    width: number;
}

export class StrokeJsonPreparedProdLikePipelineIterationResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    document_json: Uint8Array;
    duration_ms: number;
    gzip_bytes: number;
    pass_number: number;
    raw_bytes: number;
    stroke_count: number;
    total_points: number;
}

export class StrokeJsonPreparedPublishDocument {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    document_json: Uint8Array;
    height: number;
    kind: string;
    largest_skipped_stroke_coverage_pixels: number;
    get max_stroke_coverage_pixels(): number | undefined;
    set max_stroke_coverage_pixels(value: number | null | undefined);
    protected_tail_point_count: number;
    protected_tail_stroke_count: number;
    skipped_partial_compaction_stroke_count: number;
    stroke_count: number;
    total_points: number;
    version: number;
    width: number;
}

export class StrokeJsonPreparedStorageDocument {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    canonical_json: Uint8Array;
    compressed_bytes: Uint8Array;
    height: number;
    kind: string;
    stroke_count: number;
    total_points: number;
    version: number;
    width: number;
}

export function compact_document_losslessly_with_report(document_json: Uint8Array, options_json?: string | null): StrokeJsonPreparedLosslessCompactionDocument;

export function decode_canonical_document(payload: Uint8Array): Uint8Array;

export function decode_editable_document(payload: Uint8Array): Uint8Array;

export function normalize_editable_document(document_json: Uint8Array): Uint8Array;

export function prepare_publish_document(document_json: Uint8Array, options_json?: string | null): StrokeJsonPreparedPublishDocument;

export function prepare_storage_document(document_json: Uint8Array): StrokeJsonPreparedStorageDocument;

export function run_prod_like_pipeline(document_json: Uint8Array, options_json?: string | null): StrokeJsonPreparedProdLikePipelineDocument;

export function serialize_canonical_document(document_json: Uint8Array): Uint8Array;

export function start(): void;

export function stroke_json_wasm_version(): string;

export function validate_document(document_json: Uint8Array): StrokeJsonDocumentMetadata;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_get_strokejsondocumentmetadata_height: (a: number) => number;
    readonly __wbg_get_strokejsondocumentmetadata_kind: (a: number) => [number, number];
    readonly __wbg_get_strokejsondocumentmetadata_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsondocumentmetadata_total_points: (a: number) => number;
    readonly __wbg_get_strokejsondocumentmetadata_version: (a: number) => number;
    readonly __wbg_get_strokejsondocumentmetadata_width: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_document_json: (a: number) => [number, number];
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_height: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_kind: (a: number) => [number, number];
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_largest_skipped_stroke_coverage_pixels: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_max_stroke_coverage_pixels: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_skipped_partial_compaction_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_total_points: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_version: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedlosslesscompactiondocument_width: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_final_document_json: (a: number) => [number, number];
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_iterations: (a: number) => any;
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_kind: (a: number) => [number, number];
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_total_duration_ms: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_width: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelineiterationresult_raw_bytes: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelineiterationresult_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_largest_skipped_stroke_coverage_pixels: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_skipped_partial_compaction_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedstoragedocument_canonical_json: (a: number) => [number, number];
    readonly __wbg_set_strokejsondocumentmetadata_height: (a: number, b: number) => void;
    readonly __wbg_set_strokejsondocumentmetadata_kind: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsondocumentmetadata_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsondocumentmetadata_total_points: (a: number, b: number) => void;
    readonly __wbg_set_strokejsondocumentmetadata_version: (a: number, b: number) => void;
    readonly __wbg_set_strokejsondocumentmetadata_width: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_document_json: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_height: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_kind: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_largest_skipped_stroke_coverage_pixels: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_max_stroke_coverage_pixels: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_skipped_partial_compaction_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_total_points: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_version: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedlosslesscompactiondocument_width: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_final_document_json: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_iterations: (a: number, b: any) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_kind: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_total_duration_ms: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_width: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelineiterationresult_raw_bytes: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelineiterationresult_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_largest_skipped_stroke_coverage_pixels: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_skipped_partial_compaction_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedstoragedocument_compressed_bytes: (a: number, b: number, c: number) => void;
    readonly __wbg_strokejsondocumentmetadata_free: (a: number, b: number) => void;
    readonly __wbg_strokejsonpreparedlosslesscompactiondocument_free: (a: number, b: number) => void;
    readonly __wbg_strokejsonpreparedprodlikepipelinedocument_free: (a: number, b: number) => void;
    readonly __wbg_strokejsonpreparedprodlikepipelineiterationresult_free: (a: number, b: number) => void;
    readonly __wbg_strokejsonpreparedpublishdocument_free: (a: number, b: number) => void;
    readonly __wbg_strokejsonpreparedstoragedocument_free: (a: number, b: number) => void;
    readonly compact_document_losslessly_with_report: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly decode_canonical_document: (a: number, b: number) => [number, number, number, number];
    readonly decode_editable_document: (a: number, b: number) => [number, number, number, number];
    readonly normalize_editable_document: (a: number, b: number) => [number, number, number, number];
    readonly prepare_publish_document: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly prepare_storage_document: (a: number, b: number) => [number, number, number];
    readonly run_prod_like_pipeline: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly serialize_canonical_document: (a: number, b: number) => [number, number, number, number];
    readonly start: () => void;
    readonly stroke_json_wasm_version: () => [number, number];
    readonly validate_document: (a: number, b: number) => [number, number, number];
    readonly __wbg_get_strokejsonpreparedpublishdocument_kind: (a: number) => [number, number];
    readonly __wbg_get_strokejsonpreparedstoragedocument_kind: (a: number) => [number, number];
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_height: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_total_points: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelinedocument_version: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelineiterationresult_duration_ms: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelineiterationresult_gzip_bytes: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelineiterationresult_pass_number: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedprodlikepipelineiterationresult_total_points: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_height: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_protected_tail_point_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_protected_tail_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_total_points: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_version: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_width: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedstoragedocument_height: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedstoragedocument_stroke_count: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedstoragedocument_total_points: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedstoragedocument_version: (a: number, b: number) => void;
    readonly __wbg_set_strokejsonpreparedstoragedocument_width: (a: number, b: number) => void;
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_height: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_total_points: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelinedocument_version: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelineiterationresult_duration_ms: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelineiterationresult_gzip_bytes: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelineiterationresult_pass_number: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedprodlikepipelineiterationresult_total_points: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_height: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_protected_tail_point_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_protected_tail_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_total_points: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_version: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedpublishdocument_width: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedstoragedocument_height: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedstoragedocument_stroke_count: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedstoragedocument_total_points: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedstoragedocument_version: (a: number) => number;
    readonly __wbg_get_strokejsonpreparedstoragedocument_width: (a: number) => number;
    readonly __wbg_set_strokejsonpreparedpublishdocument_max_stroke_coverage_pixels: (a: number, b: number) => void;
    readonly __wbg_get_strokejsonpreparedprodlikepipelineiterationresult_document_json: (a: number) => [number, number];
    readonly __wbg_get_strokejsonpreparedpublishdocument_document_json: (a: number) => [number, number];
    readonly __wbg_get_strokejsonpreparedstoragedocument_compressed_bytes: (a: number) => [number, number];
    readonly __wbg_get_strokejsonpreparedpublishdocument_max_stroke_coverage_pixels: (a: number) => number;
    readonly __wbg_set_strokejsonpreparedprodlikepipelineiterationresult_document_json: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_document_json: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsonpreparedpublishdocument_kind: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsonpreparedstoragedocument_canonical_json: (a: number, b: number, c: number) => void;
    readonly __wbg_set_strokejsonpreparedstoragedocument_kind: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
