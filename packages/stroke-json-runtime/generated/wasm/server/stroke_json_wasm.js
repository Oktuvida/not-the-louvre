/* @ts-self-types="./stroke_json_wasm.d.ts" */

export class StrokeJsonDocumentMetadata {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StrokeJsonDocumentMetadata.prototype);
        obj.__wbg_ptr = ptr;
        StrokeJsonDocumentMetadataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrokeJsonDocumentMetadataFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strokejsondocumentmetadata_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_strokejsondocumentmetadata_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get kind() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.__wbg_get_strokejsondocumentmetadata_kind(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get stroke_count() {
        const ret = wasm.__wbg_get_strokejsondocumentmetadata_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get total_points() {
        const ret = wasm.__wbg_get_strokejsondocumentmetadata_total_points(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get version() {
        const ret = wasm.__wbg_get_strokejsondocumentmetadata_version(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_strokejsondocumentmetadata_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_strokejsondocumentmetadata_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {string} arg0
     */
    set kind(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsondocumentmetadata_kind(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set stroke_count(arg0) {
        wasm.__wbg_set_strokejsondocumentmetadata_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total_points(arg0) {
        wasm.__wbg_set_strokejsondocumentmetadata_total_points(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set version(arg0) {
        wasm.__wbg_set_strokejsondocumentmetadata_version(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_strokejsondocumentmetadata_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) StrokeJsonDocumentMetadata.prototype[Symbol.dispose] = StrokeJsonDocumentMetadata.prototype.free;

export class StrokeJsonPreparedLosslessCompactionDocument {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StrokeJsonPreparedLosslessCompactionDocument.prototype);
        obj.__wbg_ptr = ptr;
        StrokeJsonPreparedLosslessCompactionDocumentFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrokeJsonPreparedLosslessCompactionDocumentFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strokejsonpreparedlosslesscompactiondocument_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get document_json() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_document_json(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get kind() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_kind(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get largest_skipped_stroke_coverage_pixels() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_largest_skipped_stroke_coverage_pixels(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number | undefined}
     */
    get max_stroke_coverage_pixels() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_max_stroke_coverage_pixels(this.__wbg_ptr);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * @returns {number}
     */
    get skipped_partial_compaction_stroke_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_skipped_partial_compaction_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get stroke_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get total_points() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_total_points(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get version() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_version(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_strokejsonpreparedlosslesscompactiondocument_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Uint8Array} arg0
     */
    set document_json(arg0) {
        const ptr0 = passArray8ToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_document_json(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {string} arg0
     */
    set kind(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_kind(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set largest_skipped_stroke_coverage_pixels(arg0) {
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_largest_skipped_stroke_coverage_pixels(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number | null} [arg0]
     */
    set max_stroke_coverage_pixels(arg0) {
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_max_stroke_coverage_pixels(this.__wbg_ptr, isLikeNone(arg0) ? 0x100000001 : (arg0) >>> 0);
    }
    /**
     * @param {number} arg0
     */
    set skipped_partial_compaction_stroke_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_skipped_partial_compaction_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set stroke_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total_points(arg0) {
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_total_points(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set version(arg0) {
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_version(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_strokejsonpreparedlosslesscompactiondocument_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) StrokeJsonPreparedLosslessCompactionDocument.prototype[Symbol.dispose] = StrokeJsonPreparedLosslessCompactionDocument.prototype.free;

export class StrokeJsonPreparedProdLikePipelineDocument {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StrokeJsonPreparedProdLikePipelineDocument.prototype);
        obj.__wbg_ptr = ptr;
        StrokeJsonPreparedProdLikePipelineDocumentFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrokeJsonPreparedProdLikePipelineDocumentFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strokejsonpreparedprodlikepipelinedocument_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get final_document_json() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_final_document_json(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Array<any>}
     */
    get iterations() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_iterations(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get kind() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_kind(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get stroke_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get total_duration_ms() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_total_duration_ms(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get total_points() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_total_points(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get version() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_version(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelinedocument_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Uint8Array} arg0
     */
    set final_document_json(arg0) {
        const ptr0 = passArray8ToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_final_document_json(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {Array<any>} arg0
     */
    set iterations(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_iterations(this.__wbg_ptr, arg0);
    }
    /**
     * @param {string} arg0
     */
    set kind(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_kind(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set stroke_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total_duration_ms(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_total_duration_ms(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total_points(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_total_points(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set version(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_version(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelinedocument_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) StrokeJsonPreparedProdLikePipelineDocument.prototype[Symbol.dispose] = StrokeJsonPreparedProdLikePipelineDocument.prototype.free;

export class StrokeJsonPreparedProdLikePipelineIterationResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StrokeJsonPreparedProdLikePipelineIterationResult.prototype);
        obj.__wbg_ptr = ptr;
        StrokeJsonPreparedProdLikePipelineIterationResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrokeJsonPreparedProdLikePipelineIterationResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strokejsonpreparedprodlikepipelineiterationresult_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get document_json() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelineiterationresult_document_json(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    get duration_ms() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelineiterationresult_duration_ms(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get gzip_bytes() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelineiterationresult_gzip_bytes(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get pass_number() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelineiterationresult_pass_number(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get raw_bytes() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelineiterationresult_raw_bytes(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get stroke_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelineiterationresult_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get total_points() {
        const ret = wasm.__wbg_get_strokejsonpreparedprodlikepipelineiterationresult_total_points(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {Uint8Array} arg0
     */
    set document_json(arg0) {
        const ptr0 = passArray8ToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedprodlikepipelineiterationresult_document_json(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set duration_ms(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelineiterationresult_duration_ms(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set gzip_bytes(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelineiterationresult_gzip_bytes(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set pass_number(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelineiterationresult_pass_number(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set raw_bytes(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelineiterationresult_raw_bytes(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set stroke_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelineiterationresult_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total_points(arg0) {
        wasm.__wbg_set_strokejsonpreparedprodlikepipelineiterationresult_total_points(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) StrokeJsonPreparedProdLikePipelineIterationResult.prototype[Symbol.dispose] = StrokeJsonPreparedProdLikePipelineIterationResult.prototype.free;

export class StrokeJsonPreparedPublishDocument {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StrokeJsonPreparedPublishDocument.prototype);
        obj.__wbg_ptr = ptr;
        StrokeJsonPreparedPublishDocumentFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrokeJsonPreparedPublishDocumentFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strokejsonpreparedpublishdocument_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get document_json() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_document_json(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get kind() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_kind(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get largest_skipped_stroke_coverage_pixels() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_largest_skipped_stroke_coverage_pixels(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number | undefined}
     */
    get max_stroke_coverage_pixels() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_max_stroke_coverage_pixels(this.__wbg_ptr);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * @returns {number}
     */
    get protected_tail_point_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_protected_tail_point_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get protected_tail_stroke_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_protected_tail_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get skipped_partial_compaction_stroke_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_skipped_partial_compaction_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get stroke_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get total_points() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_total_points(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get version() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_version(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_strokejsonpreparedpublishdocument_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Uint8Array} arg0
     */
    set document_json(arg0) {
        const ptr0 = passArray8ToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedpublishdocument_document_json(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {string} arg0
     */
    set kind(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedpublishdocument_kind(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set largest_skipped_stroke_coverage_pixels(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_largest_skipped_stroke_coverage_pixels(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number | null} [arg0]
     */
    set max_stroke_coverage_pixels(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_max_stroke_coverage_pixels(this.__wbg_ptr, isLikeNone(arg0) ? 0x100000001 : (arg0) >>> 0);
    }
    /**
     * @param {number} arg0
     */
    set protected_tail_point_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_protected_tail_point_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set protected_tail_stroke_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_protected_tail_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set skipped_partial_compaction_stroke_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_skipped_partial_compaction_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set stroke_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total_points(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_total_points(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set version(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_version(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_strokejsonpreparedpublishdocument_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) StrokeJsonPreparedPublishDocument.prototype[Symbol.dispose] = StrokeJsonPreparedPublishDocument.prototype.free;

export class StrokeJsonPreparedStorageDocument {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StrokeJsonPreparedStorageDocument.prototype);
        obj.__wbg_ptr = ptr;
        StrokeJsonPreparedStorageDocumentFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrokeJsonPreparedStorageDocumentFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strokejsonpreparedstoragedocument_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get canonical_json() {
        const ret = wasm.__wbg_get_strokejsonpreparedstoragedocument_canonical_json(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get compressed_bytes() {
        const ret = wasm.__wbg_get_strokejsonpreparedstoragedocument_compressed_bytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_strokejsonpreparedstoragedocument_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get kind() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.__wbg_get_strokejsonpreparedstoragedocument_kind(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get stroke_count() {
        const ret = wasm.__wbg_get_strokejsonpreparedstoragedocument_stroke_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get total_points() {
        const ret = wasm.__wbg_get_strokejsonpreparedstoragedocument_total_points(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get version() {
        const ret = wasm.__wbg_get_strokejsonpreparedstoragedocument_version(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_strokejsonpreparedstoragedocument_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Uint8Array} arg0
     */
    set canonical_json(arg0) {
        const ptr0 = passArray8ToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedstoragedocument_canonical_json(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set compressed_bytes(arg0) {
        const ptr0 = passArray8ToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedstoragedocument_compressed_bytes(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_strokejsonpreparedstoragedocument_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {string} arg0
     */
    set kind(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strokejsonpreparedstoragedocument_kind(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set stroke_count(arg0) {
        wasm.__wbg_set_strokejsonpreparedstoragedocument_stroke_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set total_points(arg0) {
        wasm.__wbg_set_strokejsonpreparedstoragedocument_total_points(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set version(arg0) {
        wasm.__wbg_set_strokejsonpreparedstoragedocument_version(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_strokejsonpreparedstoragedocument_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) StrokeJsonPreparedStorageDocument.prototype[Symbol.dispose] = StrokeJsonPreparedStorageDocument.prototype.free;

/**
 * @param {Uint8Array} document_json
 * @param {string | null} [options_json]
 * @returns {StrokeJsonPreparedLosslessCompactionDocument}
 */
export function compact_document_losslessly_with_report(document_json, options_json) {
    const ptr0 = passArray8ToWasm0(document_json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(options_json) ? 0 : passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.compact_document_losslessly_with_report(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return StrokeJsonPreparedLosslessCompactionDocument.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
export function decode_canonical_document(payload) {
    const ptr0 = passArray8ToWasm0(payload, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_canonical_document(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
export function decode_editable_document(payload) {
    const ptr0 = passArray8ToWasm0(payload, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_editable_document(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} document_json
 * @returns {Uint8Array}
 */
export function normalize_editable_document(document_json) {
    const ptr0 = passArray8ToWasm0(document_json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.normalize_editable_document(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} document_json
 * @param {string | null} [options_json]
 * @returns {StrokeJsonPreparedPublishDocument}
 */
export function prepare_publish_document(document_json, options_json) {
    const ptr0 = passArray8ToWasm0(document_json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(options_json) ? 0 : passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.prepare_publish_document(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return StrokeJsonPreparedPublishDocument.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} document_json
 * @returns {StrokeJsonPreparedStorageDocument}
 */
export function prepare_storage_document(document_json) {
    const ptr0 = passArray8ToWasm0(document_json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.prepare_storage_document(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return StrokeJsonPreparedStorageDocument.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} document_json
 * @param {string | null} [options_json]
 * @returns {StrokeJsonPreparedProdLikePipelineDocument}
 */
export function run_prod_like_pipeline(document_json, options_json) {
    const ptr0 = passArray8ToWasm0(document_json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(options_json) ? 0 : passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.run_prod_like_pipeline(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return StrokeJsonPreparedProdLikePipelineDocument.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} document_json
 * @returns {Uint8Array}
 */
export function serialize_canonical_document(document_json) {
    const ptr0 = passArray8ToWasm0(document_json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.serialize_canonical_document(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

export function start() {
    wasm.start();
}

/**
 * @returns {string}
 */
export function stroke_json_wasm_version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.stroke_json_wasm_version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {Uint8Array} document_json
 * @returns {StrokeJsonDocumentMetadata}
 */
export function validate_document(document_json) {
    const ptr0 = passArray8ToWasm0(document_json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.validate_document(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return StrokeJsonDocumentMetadata.__wrap(ret[0]);
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_2e59b1b37a9a34c3: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_is_function_49868bde5eb1e745: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_344c8750a8525473: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_undefined_c0cca72b82b86f4d: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_number_get_7579aab02a8a620c: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_throw_81fc77679af83bc6: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_7f2987183bb62793: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_get_f96702c6245e4ef9: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_new_f3c9df4f38f3f798: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_now_88621c9c9a4f3ffc: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_push_6bdbc990be5ac37b: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_static_accessor_GLOBAL_THIS_a1248013d790bf5f: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_f2e0f995a21329ff: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_24f78b6d23f286ea: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_59fd959c540fe405: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_strokejsonpreparedprodlikepipelineiterationresult_new: function(arg0) {
            const ret = StrokeJsonPreparedProdLikePipelineIterationResult.__wrap(arg0);
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./stroke_json_wasm_bg.js": import0,
    };
}

const StrokeJsonDocumentMetadataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_strokejsondocumentmetadata_free(ptr >>> 0, 1));
const StrokeJsonPreparedLosslessCompactionDocumentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_strokejsonpreparedlosslesscompactiondocument_free(ptr >>> 0, 1));
const StrokeJsonPreparedProdLikePipelineDocumentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_strokejsonpreparedprodlikepipelinedocument_free(ptr >>> 0, 1));
const StrokeJsonPreparedProdLikePipelineIterationResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_strokejsonpreparedprodlikepipelineiterationresult_free(ptr >>> 0, 1));
const StrokeJsonPreparedPublishDocumentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_strokejsonpreparedpublishdocument_free(ptr >>> 0, 1));
const StrokeJsonPreparedStorageDocumentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_strokejsonpreparedstoragedocument_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('stroke_json_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
