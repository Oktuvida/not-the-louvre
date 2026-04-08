use std::fmt;
use std::io::{Read, Write};

use flate2::Compression;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use serde::{Deserialize, Serialize};

mod exact;
mod prod_like;

pub use exact::*;
pub use prod_like::*;

pub const STROKE_JSON_WASM_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const DRAWING_DOCUMENT_V1_VERSION: u32 = 1;
pub const DRAWING_DOCUMENT_V2_VERSION: u32 = 2;

const ARTWORK_WIDTH: u32 = 768;
const ARTWORK_HEIGHT: u32 = 768;
const ARTWORK_BACKGROUND: &str = "#fdfbf7";
const AVATAR_WIDTH: u32 = 340;
const AVATAR_HEIGHT: u32 = 340;
const AVATAR_BACKGROUND: &str = "#f5f0e1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StrokeJsonDocumentLimits {
    pub max_compressed_bytes: usize,
    pub max_decompressed_bytes: usize,
    pub max_points_per_stroke: usize,
    pub max_strokes: usize,
    pub max_total_points: usize,
}

impl Default for StrokeJsonDocumentLimits {
    fn default() -> Self {
        Self {
            max_compressed_bytes: 256 * 1024,
            max_decompressed_bytes: 1024 * 1024,
            max_points_per_stroke: 5_000,
            max_strokes: 5_000,
            max_total_points: 100_000,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StrokeJsonError {
    InvalidJson { message: String },
    InvalidDocument { message: String },
    DocumentLimitsExceeded { message: String },
    CompressionFailed { message: String },
    DecompressionFailed { message: String },
}

impl fmt::Display for StrokeJsonError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson { message }
            | Self::InvalidDocument { message }
            | Self::DocumentLimitsExceeded { message }
            | Self::CompressionFailed { message }
            | Self::DecompressionFailed { message } => formatter.write_str(message),
        }
    }
}

impl std::error::Error for StrokeJsonError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DrawingDocumentKind {
    Artwork,
    Avatar,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DrawingStroke {
    pub color: String,
    pub size: u32,
    pub points: Vec<[u32; 2]>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DrawingDocumentV1 {
    pub version: u32,
    pub kind: DrawingDocumentKind,
    pub width: u32,
    pub height: u32,
    pub background: String,
    pub strokes: Vec<DrawingStroke>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DrawingDocumentV2 {
    pub version: u32,
    pub kind: DrawingDocumentKind,
    pub width: u32,
    pub height: u32,
    pub background: String,
    pub base: Vec<DrawingStroke>,
    pub tail: Vec<DrawingStroke>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DrawingDocument {
    V1(DrawingDocumentV1),
    V2(DrawingDocumentV2),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StrokeJsonDocumentMetadata {
    pub version: u32,
    pub kind: DrawingDocumentKind,
    pub width: u32,
    pub height: u32,
    pub stroke_count: u32,
    pub total_points: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StrokeJsonPreparedStorageDocument {
    pub canonical_json: Vec<u8>,
    pub compressed_bytes: Vec<u8>,
    pub version: u32,
    pub kind: DrawingDocumentKind,
    pub width: u32,
    pub height: u32,
    pub stroke_count: u32,
    pub total_points: u32,
}

#[derive(Debug, Deserialize)]
struct VersionProbe {
    version: u32,
}

pub fn stroke_json_wasm_version() -> &'static str {
    STROKE_JSON_WASM_VERSION
}

pub fn validate_document(
    document_json: &[u8],
) -> Result<StrokeJsonDocumentMetadata, StrokeJsonError> {
    let document = parse_and_validate_document_shape_only(document_json)?;
    assert_document_complexity_limits(&document, StrokeJsonDocumentLimits::default())?;
    Ok(metadata_from_document(&document))
}

pub fn normalize_editable_document(document_json: &[u8]) -> Result<Vec<u8>, StrokeJsonError> {
    let document = parse_and_validate_document(document_json)?;
    serialize_document_v2(&normalize_document_to_editable_v2(&document))
}

pub fn serialize_canonical_document(document_json: &[u8]) -> Result<Vec<u8>, StrokeJsonError> {
    let document = parse_and_validate_document(document_json)?;
    serialize_document_v2(&normalize_document_to_canonical_v2(&document))
}

pub fn encode_validated_document(document: &DrawingDocumentV2) -> Result<Vec<u8>, StrokeJsonError> {
    encode_validated_document_with_limits(document, StrokeJsonDocumentLimits::default())
}

pub fn encode_validated_document_with_limits(
    document: &DrawingDocumentV2,
    limits: StrokeJsonDocumentLimits,
) -> Result<Vec<u8>, StrokeJsonError> {
    let wrapped_document = DrawingDocument::V2(document.clone());
    validate_document_shape(&wrapped_document)?;
    assert_document_complexity_limits(&wrapped_document, limits)?;

    let canonical_json = serialize_document_v2(document)?;
    compress_canonical_json(&canonical_json, limits)
}

pub fn prepare_storage_document(
    document_json: &[u8],
) -> Result<StrokeJsonPreparedStorageDocument, StrokeJsonError> {
    prepare_storage_document_with_limits(document_json, StrokeJsonDocumentLimits::default())
}

pub fn prepare_storage_document_with_limits(
    document_json: &[u8],
    limits: StrokeJsonDocumentLimits,
) -> Result<StrokeJsonPreparedStorageDocument, StrokeJsonError> {
    let document = parse_and_validate_document(document_json)?;
    let canonical_document = normalize_document_to_canonical_v2(&document);
    let canonical_json = serialize_document_v2(&canonical_document)?;
    let compressed_bytes = compress_canonical_json(&canonical_json, limits)?;
    let metadata = metadata_from_v2(&canonical_document);

    Ok(StrokeJsonPreparedStorageDocument {
        canonical_json,
        compressed_bytes,
        version: canonical_document.version,
        kind: metadata.kind,
        width: metadata.width,
        height: metadata.height,
        stroke_count: metadata.stroke_count,
        total_points: metadata.total_points,
    })
}

pub fn decode_editable_document(payload: &[u8]) -> Result<Vec<u8>, StrokeJsonError> {
    let decompressed = decompress_document_payload(payload, StrokeJsonDocumentLimits::default())?;
    normalize_editable_document(&decompressed)
}

pub fn decode_canonical_document(payload: &[u8]) -> Result<Vec<u8>, StrokeJsonError> {
    let decompressed = decompress_document_payload(payload, StrokeJsonDocumentLimits::default())?;
    serialize_canonical_document(&decompressed)
}

fn parse_and_validate_document_shape_only(
    document_json: &[u8],
) -> Result<DrawingDocument, StrokeJsonError> {
    let document = parse_document(document_json)?;
    validate_document_shape(&document)?;
    Ok(document)
}

fn parse_and_validate_document(document_json: &[u8]) -> Result<DrawingDocument, StrokeJsonError> {
    let document = parse_and_validate_document_shape_only(document_json)?;
    assert_document_complexity_limits(&document, StrokeJsonDocumentLimits::default())?;
    Ok(document)
}

fn parse_document(document_json: &[u8]) -> Result<DrawingDocument, StrokeJsonError> {
    let probe = serde_json::from_slice::<VersionProbe>(document_json).map_err(|_| {
        StrokeJsonError::InvalidJson {
            message: "Invalid drawing document JSON".to_string(),
        }
    })?;

    match probe.version {
        DRAWING_DOCUMENT_V1_VERSION => serde_json::from_slice::<DrawingDocumentV1>(document_json)
            .map(DrawingDocument::V1)
            .map_err(|error| StrokeJsonError::InvalidDocument {
                message: format!("Invalid drawing document: {error}"),
            }),
        DRAWING_DOCUMENT_V2_VERSION => serde_json::from_slice::<DrawingDocumentV2>(document_json)
            .map(DrawingDocument::V2)
            .map_err(|error| StrokeJsonError::InvalidDocument {
                message: format!("Invalid drawing document: {error}"),
            }),
        version => Err(StrokeJsonError::InvalidDocument {
            message: format!("Unsupported drawing document version: {version}"),
        }),
    }
}

fn validate_document_shape(document: &DrawingDocument) -> Result<(), StrokeJsonError> {
    match document {
        DrawingDocument::V1(document) => {
            validate_dimensions(
                document.kind,
                document.width,
                document.height,
                &document.background,
            )?;
            validate_strokes(
                &document.strokes,
                document.width,
                document.height,
                "strokes",
            )
        }
        DrawingDocument::V2(document) => {
            validate_dimensions(
                document.kind,
                document.width,
                document.height,
                &document.background,
            )?;
            validate_strokes(&document.base, document.width, document.height, "base")?;
            validate_strokes(&document.tail, document.width, document.height, "tail")
        }
    }
}

fn validate_dimensions(
    kind: DrawingDocumentKind,
    width: u32,
    height: u32,
    background: &str,
) -> Result<(), StrokeJsonError> {
    let (expected_width, expected_height, expected_background) = match kind {
        DrawingDocumentKind::Artwork => (ARTWORK_WIDTH, ARTWORK_HEIGHT, ARTWORK_BACKGROUND),
        DrawingDocumentKind::Avatar => (AVATAR_WIDTH, AVATAR_HEIGHT, AVATAR_BACKGROUND),
    };

    if width != expected_width || height != expected_height || background != expected_background {
        return Err(StrokeJsonError::InvalidDocument {
            message: format!(
                "Invalid {kind:?} drawing dimensions/background; expected {expected_width}x{expected_height} with {expected_background}"
            ),
        });
    }

    Ok(())
}

fn validate_strokes(
    strokes: &[DrawingStroke],
    width: u32,
    height: u32,
    collection_name: &str,
) -> Result<(), StrokeJsonError> {
    for (stroke_index, stroke) in strokes.iter().enumerate() {
        if !is_valid_color(&stroke.color) {
            return Err(StrokeJsonError::InvalidDocument {
                message: format!(
                    "Invalid drawing document: stroke {collection_name}[{stroke_index}] has invalid color"
                ),
            });
        }

        if !(1..=64).contains(&stroke.size) {
            return Err(StrokeJsonError::InvalidDocument {
                message: format!(
                    "Invalid drawing document: stroke {collection_name}[{stroke_index}] size must be between 1 and 64"
                ),
            });
        }

        if stroke.points.is_empty() {
            return Err(StrokeJsonError::InvalidDocument {
                message: format!(
                    "Invalid drawing document: stroke {collection_name}[{stroke_index}] must contain at least one point"
                ),
            });
        }

        for (point_index, point) in stroke.points.iter().enumerate() {
            if point[0] > width {
                return Err(StrokeJsonError::InvalidDocument {
                    message: format!(
                        "Invalid drawing document: point {collection_name}[{stroke_index}].points[{point_index}][0] must be within canvas width {width}"
                    ),
                });
            }

            if point[1] > height {
                return Err(StrokeJsonError::InvalidDocument {
                    message: format!(
                        "Invalid drawing document: point {collection_name}[{stroke_index}].points[{point_index}][1] must be within canvas height {height}"
                    ),
                });
            }
        }
    }

    Ok(())
}

fn normalize_document_to_canonical_v2(document: &DrawingDocument) -> DrawingDocumentV2 {
    match document {
        DrawingDocument::V1(document) => DrawingDocumentV2 {
            version: DRAWING_DOCUMENT_V2_VERSION,
            kind: document.kind,
            width: document.width,
            height: document.height,
            background: document.background.clone(),
            base: document.strokes.clone(),
            tail: Vec::new(),
        },
        DrawingDocument::V2(document) => document.clone(),
    }
}

fn normalize_document_to_editable_v2(document: &DrawingDocument) -> DrawingDocumentV2 {
    match document {
        DrawingDocument::V1(document) => DrawingDocumentV2 {
            version: DRAWING_DOCUMENT_V2_VERSION,
            kind: document.kind,
            width: document.width,
            height: document.height,
            background: document.background.clone(),
            base: Vec::new(),
            tail: document.strokes.clone(),
        },
        DrawingDocument::V2(document) => document.clone(),
    }
}

fn serialize_document_v2(document: &DrawingDocumentV2) -> Result<Vec<u8>, StrokeJsonError> {
    serde_json::to_vec(document).map_err(|error| StrokeJsonError::InvalidDocument {
        message: format!("Failed to serialize drawing document: {error}"),
    })
}

fn assert_document_byte_limits(
    document: &DrawingDocument,
    limits: StrokeJsonDocumentLimits,
) -> Result<(), StrokeJsonError> {
    let serialized = match document {
        DrawingDocument::V1(document) => serde_json::to_vec(document),
        DrawingDocument::V2(document) => serde_json::to_vec(document),
    }
    .map_err(|error| StrokeJsonError::InvalidDocument {
        message: format!("Failed to serialize drawing document: {error}"),
    })?;

    if serialized.len() > limits.max_decompressed_bytes {
        return Err(StrokeJsonError::DocumentLimitsExceeded {
            message: format!(
                "Drawing document exceeds max decompressed bytes of {}",
                limits.max_decompressed_bytes
            ),
        });
    }

    Ok(())
}

fn assert_document_complexity_limits(
    document: &DrawingDocument,
    limits: StrokeJsonDocumentLimits,
) -> Result<(), StrokeJsonError> {
    let strokes = renderable_strokes(document);
    if strokes.len() > limits.max_strokes {
        return Err(StrokeJsonError::DocumentLimitsExceeded {
            message: format!(
                "Drawing document exceeds max strokes of {}",
                limits.max_strokes
            ),
        });
    }

    let total_points = strokes
        .iter()
        .map(|stroke| stroke.points.len())
        .sum::<usize>();
    if total_points > limits.max_total_points {
        return Err(StrokeJsonError::DocumentLimitsExceeded {
            message: format!(
                "Drawing document exceeds max total points of {}",
                limits.max_total_points
            ),
        });
    }

    for stroke in strokes {
        if stroke.points.len() > limits.max_points_per_stroke {
            return Err(StrokeJsonError::DocumentLimitsExceeded {
                message: format!(
                    "Drawing document exceeds max points per stroke of {}",
                    limits.max_points_per_stroke
                ),
            });
        }
    }

    Ok(())
}

fn assert_document_within_limits(
    document: &DrawingDocument,
    limits: StrokeJsonDocumentLimits,
) -> Result<(), StrokeJsonError> {
    assert_document_byte_limits(document, limits)?;
    assert_document_complexity_limits(document, limits)
}

pub(crate) fn gzip_canonical_json(canonical_json: &[u8]) -> Result<Vec<u8>, StrokeJsonError> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(canonical_json)
        .map_err(|error| StrokeJsonError::CompressionFailed {
            message: format!("Failed to compress drawing document: {error}"),
        })?;
    encoder
        .finish()
        .map_err(|error| StrokeJsonError::CompressionFailed {
            message: format!("Failed to compress drawing document: {error}"),
        })
}

fn compress_canonical_json(
    canonical_json: &[u8],
    limits: StrokeJsonDocumentLimits,
) -> Result<Vec<u8>, StrokeJsonError> {
    if canonical_json.len() > limits.max_decompressed_bytes {
        return Err(StrokeJsonError::DocumentLimitsExceeded {
            message: format!(
                "Drawing document exceeds max decompressed bytes of {}",
                limits.max_decompressed_bytes
            ),
        });
    }

    let compressed_bytes = gzip_canonical_json(canonical_json)?;

    if compressed_bytes.len() > limits.max_compressed_bytes {
        return Err(StrokeJsonError::DocumentLimitsExceeded {
            message: format!(
                "Drawing document exceeds max compressed bytes of {}",
                limits.max_compressed_bytes
            ),
        });
    }

    Ok(compressed_bytes)
}

fn decompress_document_payload(
    payload: &[u8],
    limits: StrokeJsonDocumentLimits,
) -> Result<Vec<u8>, StrokeJsonError> {
    if payload.len() > limits.max_compressed_bytes {
        return Err(StrokeJsonError::DocumentLimitsExceeded {
            message: format!(
                "Drawing document exceeds max compressed bytes of {}",
                limits.max_compressed_bytes
            ),
        });
    }

    let mut decoder = GzDecoder::new(payload);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed).map_err(|error| {
        StrokeJsonError::DecompressionFailed {
            message: format!("Failed to decompress drawing document: {error}"),
        }
    })?;

    if decompressed.len() > limits.max_decompressed_bytes {
        return Err(StrokeJsonError::DocumentLimitsExceeded {
            message: format!(
                "Drawing document exceeds max output bytes of {}",
                limits.max_decompressed_bytes
            ),
        });
    }

    Ok(decompressed)
}

fn metadata_from_document(document: &DrawingDocument) -> StrokeJsonDocumentMetadata {
    match document {
        DrawingDocument::V1(document) => StrokeJsonDocumentMetadata {
            version: document.version,
            kind: document.kind,
            width: document.width,
            height: document.height,
            stroke_count: document.strokes.len() as u32,
            total_points: document
                .strokes
                .iter()
                .map(|stroke| stroke.points.len() as u32)
                .sum(),
        },
        DrawingDocument::V2(document) => metadata_from_v2(document),
    }
}

fn metadata_from_v2(document: &DrawingDocumentV2) -> StrokeJsonDocumentMetadata {
    StrokeJsonDocumentMetadata {
        version: document.version,
        kind: document.kind,
        width: document.width,
        height: document.height,
        stroke_count: (document.base.len() + document.tail.len()) as u32,
        total_points: document
            .base
            .iter()
            .chain(document.tail.iter())
            .map(|stroke| stroke.points.len() as u32)
            .sum(),
    }
}

fn renderable_strokes(document: &DrawingDocument) -> Vec<&DrawingStroke> {
    match document {
        DrawingDocument::V1(document) => document.strokes.iter().collect(),
        DrawingDocument::V2(document) => document.base.iter().chain(document.tail.iter()).collect(),
    }
}

fn is_valid_color(color: &str) -> bool {
    let bytes = color.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(u8::is_ascii_hexdigit)
}

#[cfg(test)]
mod tests {
    use super::stroke_json_wasm_version;

    #[test]
    fn exposes_a_non_empty_workspace_version() {
        assert!(!stroke_json_wasm_version().is_empty());
    }
}
