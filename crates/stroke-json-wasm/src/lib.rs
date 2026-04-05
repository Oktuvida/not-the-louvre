use js_sys::Array;
use wasm_bindgen::prelude::*;

fn document_kind_to_string(kind: stroke_json_core::DrawingDocumentKind) -> String {
    match kind {
        stroke_json_core::DrawingDocumentKind::Artwork => "artwork".to_string(),
        stroke_json_core::DrawingDocumentKind::Avatar => "avatar".to_string(),
    }
}

fn count_total_points(document: &stroke_json_core::DrawingDocumentV2) -> u32 {
    document
        .base
        .iter()
        .chain(document.tail.iter())
        .map(|stroke| stroke.points.len() as u32)
        .sum()
}

fn serialize_document_json(
    document: &stroke_json_core::DrawingDocumentV2,
) -> Result<Vec<u8>, JsError> {
    serde_json::to_vec(document)
        .map_err(|error| JsError::new(&format!("Failed to serialize drawing document: {error}")))
}

fn parse_options_json<T>(options_json: Option<String>) -> Result<T, JsError>
where
    T: for<'de> serde::Deserialize<'de> + Default,
{
    match options_json {
        Some(options_json) => serde_json::from_str(&options_json)
            .map_err(|error| JsError::new(&format!("Invalid stroke-json options JSON: {error}"))),
        None => Ok(T::default()),
    }
}

#[wasm_bindgen(getter_with_clone)]
pub struct StrokeJsonDocumentMetadata {
    pub version: i32,
    pub kind: String,
    pub width: i32,
    pub height: i32,
    pub stroke_count: u32,
    pub total_points: u32,
}

#[wasm_bindgen(getter_with_clone)]
pub struct StrokeJsonPreparedLosslessCompactionDocument {
    pub document_json: Vec<u8>,
    pub version: i32,
    pub kind: String,
    pub width: i32,
    pub height: i32,
    pub stroke_count: u32,
    pub total_points: u32,
    pub largest_skipped_stroke_coverage_pixels: u32,
    pub max_stroke_coverage_pixels: Option<u32>,
    pub skipped_partial_compaction_stroke_count: u32,
}

#[wasm_bindgen(getter_with_clone)]
pub struct StrokeJsonPreparedProdLikePipelineIterationResult {
    pub document_json: Vec<u8>,
    pub pass_number: u32,
    pub duration_ms: f64,
    pub raw_bytes: u32,
    pub gzip_bytes: u32,
    pub stroke_count: u32,
    pub total_points: u32,
}

#[wasm_bindgen(getter_with_clone)]
pub struct StrokeJsonPreparedProdLikePipelineDocument {
    pub final_document_json: Vec<u8>,
    pub iterations: Array,
    pub version: i32,
    pub kind: String,
    pub width: i32,
    pub height: i32,
    pub stroke_count: u32,
    pub total_points: u32,
    pub total_duration_ms: f64,
}

#[wasm_bindgen(getter_with_clone)]
pub struct StrokeJsonPreparedPublishDocument {
    pub document_json: Vec<u8>,
    pub version: i32,
    pub kind: String,
    pub width: i32,
    pub height: i32,
    pub stroke_count: u32,
    pub total_points: u32,
    pub protected_tail_point_count: u32,
    pub protected_tail_stroke_count: u32,
    pub largest_skipped_stroke_coverage_pixels: u32,
    pub max_stroke_coverage_pixels: Option<u32>,
    pub skipped_partial_compaction_stroke_count: u32,
}

#[wasm_bindgen(getter_with_clone)]
pub struct StrokeJsonPreparedStorageDocument {
    pub canonical_json: Vec<u8>,
    pub compressed_bytes: Vec<u8>,
    pub version: i32,
    pub kind: String,
    pub width: i32,
    pub height: i32,
    pub stroke_count: u32,
    pub total_points: u32,
}

#[wasm_bindgen(start)]
pub fn start() {}

#[wasm_bindgen]
pub fn stroke_json_wasm_version() -> String {
    stroke_json_core::stroke_json_wasm_version().to_string()
}

#[wasm_bindgen]
pub fn validate_document(document_json: &[u8]) -> Result<StrokeJsonDocumentMetadata, JsError> {
    let metadata = stroke_json_core::validate_document(document_json)
        .map_err(|error| JsError::new(&error.to_string()))?;

    Ok(StrokeJsonDocumentMetadata {
        version: metadata.version as i32,
        kind: document_kind_to_string(metadata.kind),
        width: metadata.width as i32,
        height: metadata.height as i32,
        stroke_count: metadata.stroke_count,
        total_points: metadata.total_points,
    })
}

#[wasm_bindgen]
pub fn normalize_editable_document(document_json: &[u8]) -> Result<Vec<u8>, JsError> {
    stroke_json_core::normalize_editable_document(document_json)
        .map_err(|error| JsError::new(&error.to_string()))
}

#[wasm_bindgen]
pub fn serialize_canonical_document(document_json: &[u8]) -> Result<Vec<u8>, JsError> {
    stroke_json_core::serialize_canonical_document(document_json)
        .map_err(|error| JsError::new(&error.to_string()))
}

#[wasm_bindgen]
pub fn decode_editable_document(payload: &[u8]) -> Result<Vec<u8>, JsError> {
    stroke_json_core::decode_editable_document(payload)
        .map_err(|error| JsError::new(&error.to_string()))
}

#[wasm_bindgen]
pub fn decode_canonical_document(payload: &[u8]) -> Result<Vec<u8>, JsError> {
    stroke_json_core::decode_canonical_document(payload)
        .map_err(|error| JsError::new(&error.to_string()))
}

#[wasm_bindgen]
pub fn prepare_storage_document(
    document_json: &[u8],
) -> Result<StrokeJsonPreparedStorageDocument, JsError> {
    let prepared = stroke_json_core::prepare_storage_document(document_json)
        .map_err(|error| JsError::new(&error.to_string()))?;

    Ok(StrokeJsonPreparedStorageDocument {
        canonical_json: prepared.canonical_json,
        compressed_bytes: prepared.compressed_bytes,
        version: prepared.version as i32,
        kind: document_kind_to_string(prepared.kind),
        width: prepared.width as i32,
        height: prepared.height as i32,
        stroke_count: prepared.stroke_count,
        total_points: prepared.total_points,
    })
}

#[wasm_bindgen]
pub fn prepare_publish_document(
    document_json: &[u8],
    options_json: Option<String>,
) -> Result<StrokeJsonPreparedPublishDocument, JsError> {
    let options = parse_options_json::<stroke_json_core::PreparePublishOptions>(options_json)?;
    let prepared = stroke_json_core::prepare_publish_document(document_json, options)
        .map_err(|error| JsError::new(&error.to_string()))?;

    Ok(StrokeJsonPreparedPublishDocument {
        document_json: serialize_document_json(&prepared.document)?,
        version: prepared.document.version as i32,
        kind: document_kind_to_string(prepared.document.kind),
        width: prepared.document.width as i32,
        height: prepared.document.height as i32,
        stroke_count: (prepared.document.base.len() + prepared.document.tail.len()) as u32,
        total_points: count_total_points(&prepared.document),
        protected_tail_point_count: prepared.protected_tail_point_count,
        protected_tail_stroke_count: prepared.protected_tail_stroke_count,
        largest_skipped_stroke_coverage_pixels: prepared.largest_skipped_stroke_coverage_pixels,
        max_stroke_coverage_pixels: prepared.max_stroke_coverage_pixels,
        skipped_partial_compaction_stroke_count: prepared.skipped_partial_compaction_stroke_count,
    })
}

#[wasm_bindgen]
pub fn compact_document_losslessly_with_report(
    document_json: &[u8],
    options_json: Option<String>,
) -> Result<StrokeJsonPreparedLosslessCompactionDocument, JsError> {
    let options = parse_options_json::<stroke_json_core::LosslessCompactionOptions>(options_json)?;
    let prepared =
        stroke_json_core::compact_document_losslessly_with_report(document_json, options)
            .map_err(|error| JsError::new(&error.to_string()))?;

    Ok(StrokeJsonPreparedLosslessCompactionDocument {
        document_json: serialize_document_json(&prepared.document)?,
        version: prepared.document.version as i32,
        kind: document_kind_to_string(prepared.document.kind),
        width: prepared.document.width as i32,
        height: prepared.document.height as i32,
        stroke_count: (prepared.document.base.len() + prepared.document.tail.len()) as u32,
        total_points: count_total_points(&prepared.document),
        largest_skipped_stroke_coverage_pixels: prepared
            .stats
            .largest_skipped_stroke_coverage_pixels,
        max_stroke_coverage_pixels: prepared.stats.max_stroke_coverage_pixels,
        skipped_partial_compaction_stroke_count: prepared
            .stats
            .skipped_partial_compaction_stroke_count,
    })
}

#[wasm_bindgen]
pub fn run_prod_like_pipeline(
    document_json: &[u8],
    options_json: Option<String>,
) -> Result<StrokeJsonPreparedProdLikePipelineDocument, JsError> {
    let options = parse_options_json::<stroke_json_core::ProdLikePipelineOptions>(options_json)?;
    let prepared = stroke_json_core::run_prod_like_pipeline(document_json, options)
        .map_err(|error| JsError::new(&error.to_string()))?;
    let iterations = Array::new();

    for iteration in &prepared.iterations {
        iterations.push(&JsValue::from(
            StrokeJsonPreparedProdLikePipelineIterationResult {
                document_json: serialize_document_json(&iteration.document)?,
                pass_number: iteration.pass_number,
                duration_ms: iteration.duration_ms,
                raw_bytes: iteration.raw_bytes,
                gzip_bytes: iteration.gzip_bytes,
                stroke_count: iteration.stroke_count,
                total_points: iteration.total_points,
            },
        ));
    }

    Ok(StrokeJsonPreparedProdLikePipelineDocument {
        final_document_json: serialize_document_json(&prepared.final_document)?,
        iterations,
        version: prepared.final_document.version as i32,
        kind: document_kind_to_string(prepared.final_document.kind),
        width: prepared.final_document.width as i32,
        height: prepared.final_document.height as i32,
        stroke_count: (prepared.final_document.base.len() + prepared.final_document.tail.len())
            as u32,
        total_points: count_total_points(&prepared.final_document),
        total_duration_ms: prepared.total_duration_ms,
    })
}
