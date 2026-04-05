use std::collections::HashSet;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

use crate::{
    DRAWING_DOCUMENT_V2_VERSION, DrawingDocument, DrawingDocumentV2, DrawingStroke,
    StrokeJsonDocumentLimits, StrokeJsonError, assert_document_within_limits,
    parse_and_validate_document, parse_and_validate_document_shape_only, serialize_document_v2,
};

const SAMPLE_STEP: f64 = 0.5;
const PIXEL_CENTER_MARGIN: f64 = std::f64::consts::SQRT_2 / 2.0;
const CONVERSATIVE_COVERAGE_AREA_RATIO: f64 = 0.015;
const VERY_CONSERVATIVE_COVERAGE_AREA_RATIO: f64 = 0.005;

pub const DEFAULT_CLIENT_PUBLISH_SAFE_RASTER_GUARD_PRESET_ID: &str = "veryConservative";
pub const DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS: u32 = 1_000;

#[cfg(test)]
mod tests {
    use super::{
        DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS, DEFAULT_CLIENT_PUBLISH_SAFE_RASTER_GUARD_PRESET_ID,
        LosslessCompactionOptions, PreparePublishOptions, normalize_drawing_stroke_exactly,
        prepare_publish_document, run_exact_raster_oracle,
    };
    use crate::{DrawingStroke, StrokeJsonError};

    fn create_stroke(start_x: u32, point_count: u32) -> String {
        let points = (0..point_count)
            .map(|index| {
                let x = start_x + (index % 160);
                let y = 120 + (index / 160) * 3 + (index % 2);
                format!("[{x},{y}]")
            })
            .collect::<Vec<_>>()
            .join(",");

        format!("{{\"color\":\"#2d2420\",\"size\":4,\"points\":[{points}]}}")
    }

    #[test]
    fn exact_normalization_dedupes_duplicate_and_collinear_points() {
        let normalized = normalize_drawing_stroke_exactly(&DrawingStroke {
            color: "#2d2420".to_string(),
            size: 6,
            points: vec![[10, 10], [10, 10], [20, 20], [30, 30], [40, 40]],
        });

        assert_eq!(normalized.points, vec![[10, 10], [40, 40]]);
    }

    #[test]
    fn exact_oracle_drops_fully_hidden_strokes() {
        let document_json = r##"{"version":2,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","base":[{"color":"#2d2420","size":6,"points":[[48,120],[720,120]]}],"tail":[{"color":"#c84f4f","size":18,"points":[[48,120],[720,120]]}]}"##;

        let result = run_exact_raster_oracle(
            document_json.as_bytes(),
            LosslessCompactionOptions::default(),
        )
        .expect("exact raster oracle should succeed");

        assert!(result.document.tail.is_empty());
        assert_eq!(result.document.base.len(), 1);
        assert_eq!(result.document.base[0].color, "#c84f4f");
    }

    #[test]
    fn publish_preparation_protects_the_minimal_complete_stroke_suffix() {
        let document_json = format!(
            "{{\"version\":2,\"kind\":\"artwork\",\"width\":768,\"height\":768,\"background\":\"#fdfbf7\",\"base\":[{},{}],\"tail\":[{}]}}",
            create_stroke(10, 500),
            create_stroke(210, 600),
            create_stroke(410, 450)
        );

        let prepared =
            prepare_publish_document(document_json.as_bytes(), PreparePublishOptions::default())
                .expect("publish preparation should succeed");

        assert_eq!(prepared.document.tail.len(), 2);
        assert_eq!(prepared.document.tail[0].points.len(), 600);
        assert_eq!(prepared.document.tail[1].points.len(), 450);
        assert_eq!(prepared.document.base.len(), 1);
        assert_eq!(prepared.protected_tail_stroke_count, 2);
        assert_eq!(prepared.protected_tail_point_count, 1_050);
    }

    #[test]
    fn publish_preparation_rejects_unsupported_raster_guard_presets() {
        let document_json = format!(
            "{{\"version\":1,\"kind\":\"artwork\",\"width\":768,\"height\":768,\"background\":\"#fdfbf7\",\"strokes\":[{}]}}",
            create_stroke(10, 200)
        );

        let error = prepare_publish_document(
            document_json.as_bytes(),
            PreparePublishOptions {
                raster_guard_preset_id: Some("unsupported".to_string()),
                ..PreparePublishOptions::default()
            },
        )
        .expect_err("unsupported preset should fail");

        assert!(matches!(error, StrokeJsonError::InvalidDocument { .. }));
        assert!(
            error
                .to_string()
                .contains("Unsupported raster guard preset")
        );
    }

    #[test]
    fn publish_defaults_match_current_client_contract() {
        assert_eq!(
            DEFAULT_CLIENT_PUBLISH_SAFE_RASTER_GUARD_PRESET_ID,
            "veryConservative"
        );
        assert_eq!(DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS, 1_000);
    }
}
type DrawingPoint = [u32; 2];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SafeRasterGuardPresetId {
    Canonical,
    Conservative,
    #[serde(rename = "veryConservative")]
    VeryConservative,
}

impl FromStr for SafeRasterGuardPresetId {
    type Err = StrokeJsonError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "canonical" => Ok(Self::Canonical),
            "conservative" => Ok(Self::Conservative),
            "veryConservative" => Ok(Self::VeryConservative),
            other => Err(StrokeJsonError::InvalidDocument {
                message: format!("Unsupported raster guard preset: {other}"),
            }),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResolvedSafeRasterGuardPreset {
    pub id: SafeRasterGuardPresetId,
    pub label: &'static str,
    pub max_stroke_coverage_pixels: Option<u32>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LosslessCompactionOptions {
    pub max_stroke_coverage_pixels: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LosslessCompactionStats {
    pub largest_skipped_stroke_coverage_pixels: u32,
    pub max_stroke_coverage_pixels: Option<u32>,
    pub skipped_partial_compaction_stroke_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LosslessCompactionResult {
    pub document: DrawingDocumentV2,
    pub stats: LosslessCompactionStats,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparePublishOptions {
    pub max_stroke_coverage_pixels: Option<u32>,
    pub min_tail_points: Option<u32>,
    pub raster_guard_preset_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedPublishDocument {
    pub document: DrawingDocumentV2,
    pub protected_tail_point_count: u32,
    pub protected_tail_stroke_count: u32,
    pub largest_skipped_stroke_coverage_pixels: u32,
    pub max_stroke_coverage_pixels: Option<u32>,
    pub skipped_partial_compaction_stroke_count: u32,
}

#[derive(Clone, Copy)]
struct RasterDimensions {
    width: u32,
    height: u32,
}

#[derive(Clone)]
struct StrokeSample {
    distance: f64,
    point: [f64; 2],
}

#[derive(Clone, Copy)]
struct StrokeFragmentInterval {
    start_distance: f64,
    end_distance: f64,
}

pub fn resolve_safe_raster_guard_preset(
    preset_id: SafeRasterGuardPresetId,
    dimensions: (u32, u32),
) -> ResolvedSafeRasterGuardPreset {
    let (label, max_stroke_coverage_pixels) = match preset_id {
        SafeRasterGuardPresetId::Canonical => ("Canonical (no max area)", None),
        SafeRasterGuardPresetId::Conservative => (
            "Conservative (1.5% canvas)",
            Some((dimensions.0 * dimensions.1) as f64 * CONVERSATIVE_COVERAGE_AREA_RATIO),
        ),
        SafeRasterGuardPresetId::VeryConservative => (
            "Very conservative (0.50% canvas)",
            Some((dimensions.0 * dimensions.1) as f64 * VERY_CONSERVATIVE_COVERAGE_AREA_RATIO),
        ),
    };

    ResolvedSafeRasterGuardPreset {
        id: preset_id,
        label,
        max_stroke_coverage_pixels: max_stroke_coverage_pixels
            .map(|value| value.round().max(1.0) as u32),
    }
}

pub fn normalize_drawing_stroke_exactly(stroke: &DrawingStroke) -> DrawingStroke {
    let deduped_points = dedupe_consecutive_points(&stroke.points);

    if deduped_points.len() <= 2 {
        return DrawingStroke {
            color: stroke.color.clone(),
            size: stroke.size,
            points: deduped_points,
        };
    }

    let mut normalized_points = vec![deduped_points[0]];

    for index in 1..deduped_points.len() - 1 {
        let previous = *normalized_points
            .last()
            .expect("normalized points should not be empty");
        let current = deduped_points[index];
        let next = deduped_points[index + 1];

        if is_strictly_collinear(previous, current, next) {
            continue;
        }

        normalized_points.push(current);
    }

    normalized_points.push(
        *deduped_points
            .last()
            .expect("deduped points should not be empty"),
    );

    DrawingStroke {
        color: stroke.color.clone(),
        size: stroke.size,
        points: normalized_points,
    }
}

pub fn compact_document_losslessly_with_report(
    document_json: &[u8],
    options: LosslessCompactionOptions,
) -> Result<LosslessCompactionResult, StrokeJsonError> {
    let document = parse_and_validate_document(document_json)?;
    Ok(compact_document_losslessly_from_document(
        &document, options,
    ))
}

pub fn compact_document_losslessly(
    document_json: &[u8],
    options: LosslessCompactionOptions,
) -> Result<DrawingDocumentV2, StrokeJsonError> {
    Ok(compact_document_losslessly_with_report(document_json, options)?.document)
}

pub fn run_exact_raster_oracle(
    document_json: &[u8],
    options: LosslessCompactionOptions,
) -> Result<LosslessCompactionResult, StrokeJsonError> {
    compact_document_losslessly_with_report(document_json, options)
}

pub fn prepare_publish_document(
    document_json: &[u8],
    options: PreparePublishOptions,
) -> Result<PreparedPublishDocument, StrokeJsonError> {
    let document = parse_and_validate_document_shape_only(document_json)?;
    let editable_document = normalize_document_to_editable_v2(&document);
    let ordered_strokes = editable_document
        .base
        .iter()
        .chain(editable_document.tail.iter())
        .map(normalize_drawing_stroke_exactly)
        .collect::<Vec<_>>();
    let min_tail_points = options
        .min_tail_points
        .unwrap_or(DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS);
    let protected_tail_start_index =
        get_protected_tail_start_index(&ordered_strokes, min_tail_points);
    let prefix_strokes = ordered_strokes[..protected_tail_start_index].to_vec();
    let protected_tail = ordered_strokes[protected_tail_start_index..].to_vec();
    let compaction_pixels = resolve_publish_compaction_pixels(&editable_document, &options)?;

    let compacted_prefix_result = if prefix_strokes.is_empty() {
        LosslessCompactionResult {
            document: DrawingDocumentV2 {
                version: DRAWING_DOCUMENT_V2_VERSION,
                kind: editable_document.kind,
                width: editable_document.width,
                height: editable_document.height,
                background: editable_document.background.clone(),
                base: Vec::new(),
                tail: Vec::new(),
            },
            stats: LosslessCompactionStats {
                largest_skipped_stroke_coverage_pixels: 0,
                max_stroke_coverage_pixels: compaction_pixels,
                skipped_partial_compaction_stroke_count: 0,
            },
        }
    } else {
        compact_document_losslessly_from_document(
            &DrawingDocument::V2(DrawingDocumentV2 {
                version: DRAWING_DOCUMENT_V2_VERSION,
                kind: editable_document.kind,
                width: editable_document.width,
                height: editable_document.height,
                background: editable_document.background.clone(),
                base: prefix_strokes,
                tail: Vec::new(),
            }),
            LosslessCompactionOptions {
                max_stroke_coverage_pixels: compaction_pixels,
            },
        )
    };

    let prepared_document = DrawingDocumentV2 {
        version: DRAWING_DOCUMENT_V2_VERSION,
        kind: editable_document.kind,
        width: editable_document.width,
        height: editable_document.height,
        background: editable_document.background.clone(),
        base: compacted_prefix_result.document.base,
        tail: protected_tail.clone(),
    };

    assert_document_within_limits(
        &DrawingDocument::V2(prepared_document.clone()),
        StrokeJsonDocumentLimits::default(),
    )?;

    Ok(PreparedPublishDocument {
        document: prepared_document,
        protected_tail_point_count: protected_tail
            .iter()
            .map(|stroke| stroke.points.len() as u32)
            .sum(),
        protected_tail_stroke_count: protected_tail.len() as u32,
        largest_skipped_stroke_coverage_pixels: compacted_prefix_result
            .stats
            .largest_skipped_stroke_coverage_pixels,
        max_stroke_coverage_pixels: compacted_prefix_result.stats.max_stroke_coverage_pixels,
        skipped_partial_compaction_stroke_count: compacted_prefix_result
            .stats
            .skipped_partial_compaction_stroke_count,
    })
}

fn compact_document_losslessly_from_document(
    document: &DrawingDocument,
    options: LosslessCompactionOptions,
) -> LosslessCompactionResult {
    let normalized_document = normalize_document_strokes_exactly(document);
    let ordered_strokes = normalized_document
        .base
        .iter()
        .chain(normalized_document.tail.iter())
        .cloned()
        .collect::<Vec<_>>();
    let dimensions = RasterDimensions {
        width: normalized_document.width,
        height: normalized_document.height,
    };
    let (coverage_by_stroke, owner_by_pixel) = build_ownership_buffer(&ordered_strokes, dimensions);
    let max_stroke_coverage_pixels = options.max_stroke_coverage_pixels.map(|value| value.max(1));
    let mut compacted_base = Vec::new();
    let mut skipped_partial_compaction_stroke_count = 0_u32;
    let mut largest_skipped_stroke_coverage_pixels = 0_u32;

    for (stroke_index, stroke) in ordered_strokes.iter().enumerate() {
        let original_coverage = &coverage_by_stroke[stroke_index];
        let has_later_strokes = stroke_index < ordered_strokes.len().saturating_sub(1);

        if original_coverage.is_empty() {
            continue;
        }

        if original_coverage
            .iter()
            .all(|pixel_index| owner_by_pixel[*pixel_index] > stroke_index as i32)
        {
            continue;
        }

        if has_later_strokes
            && max_stroke_coverage_pixels.is_some()
            && original_coverage.len() > max_stroke_coverage_pixels.unwrap() as usize
        {
            skipped_partial_compaction_stroke_count += 1;
            largest_skipped_stroke_coverage_pixels =
                largest_skipped_stroke_coverage_pixels.max(original_coverage.len() as u32);
            compacted_base.push(stroke.clone());
            continue;
        }

        let samples = sample_stroke_centerline(stroke);
        let visibility = samples
            .iter()
            .map(|sample| {
                !is_sample_hidden(sample, stroke_index, stroke, &owner_by_pixel, dimensions)
            })
            .collect::<Vec<_>>();

        if visibility.iter().all(|visible| *visible) {
            compacted_base.push(stroke.clone());
            continue;
        }

        let intervals = get_visible_intervals(&samples, &visibility);
        if intervals.is_empty() {
            continue;
        }

        let candidate_fragments = build_stroke_fragments(stroke, &intervals, dimensions);
        if candidate_fragments.is_empty() {
            compacted_base.push(stroke.clone());
            continue;
        }

        let candidate_coverage = collect_candidate_coverage(&candidate_fragments, dimensions);
        if !coverage_difference_is_hidden(
            original_coverage,
            &candidate_coverage,
            &owner_by_pixel,
            stroke_index,
        ) {
            compacted_base.push(stroke.clone());
            continue;
        }

        if serialized_stroke_bytes(&candidate_fragments)
            >= serialized_stroke_bytes(std::slice::from_ref(stroke))
        {
            compacted_base.push(stroke.clone());
            continue;
        }

        compacted_base.extend(candidate_fragments);
    }

    LosslessCompactionResult {
        document: DrawingDocumentV2 {
            version: DRAWING_DOCUMENT_V2_VERSION,
            kind: normalized_document.kind,
            width: normalized_document.width,
            height: normalized_document.height,
            background: normalized_document.background,
            base: compacted_base,
            tail: Vec::new(),
        },
        stats: LosslessCompactionStats {
            largest_skipped_stroke_coverage_pixels,
            max_stroke_coverage_pixels,
            skipped_partial_compaction_stroke_count,
        },
    }
}

fn normalize_document_strokes_exactly(document: &DrawingDocument) -> DrawingDocumentV2 {
    let normalized_document = normalize_document_to_v2(document);

    DrawingDocumentV2 {
        base: normalized_document
            .base
            .iter()
            .map(normalize_drawing_stroke_exactly)
            .collect(),
        tail: normalized_document
            .tail
            .iter()
            .map(normalize_drawing_stroke_exactly)
            .collect(),
        ..normalized_document
    }
}

fn normalize_document_to_v2(document: &DrawingDocument) -> DrawingDocumentV2 {
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

fn resolve_publish_compaction_pixels(
    document: &DrawingDocumentV2,
    options: &PreparePublishOptions,
) -> Result<Option<u32>, StrokeJsonError> {
    if let Some(max_stroke_coverage_pixels) = options.max_stroke_coverage_pixels {
        return Ok(Some(max_stroke_coverage_pixels.max(1)));
    }

    let preset_id = options
        .raster_guard_preset_id
        .as_deref()
        .unwrap_or(DEFAULT_CLIENT_PUBLISH_SAFE_RASTER_GUARD_PRESET_ID);
    let preset = SafeRasterGuardPresetId::from_str(preset_id)?;

    Ok(
        resolve_safe_raster_guard_preset(preset, (document.width, document.height))
            .max_stroke_coverage_pixels,
    )
}

fn get_protected_tail_start_index(
    ordered_strokes: &[DrawingStroke],
    min_tail_points: u32,
) -> usize {
    if ordered_strokes.is_empty() {
        return 0;
    }

    if min_tail_points == 0 {
        return ordered_strokes.len();
    }

    let mut total_tail_points = 0_u32;

    for stroke_index in (0..ordered_strokes.len()).rev() {
        total_tail_points += ordered_strokes[stroke_index].points.len() as u32;
        if total_tail_points >= min_tail_points || stroke_index == 0 {
            return stroke_index;
        }
    }

    0
}

fn dedupe_consecutive_points(points: &[DrawingPoint]) -> Vec<DrawingPoint> {
    let mut deduped = Vec::new();

    for point in points {
        if deduped.last().copied() != Some(*point) {
            deduped.push(*point);
        }
    }

    deduped
}

fn is_strictly_collinear(
    previous: DrawingPoint,
    current: DrawingPoint,
    next: DrawingPoint,
) -> bool {
    let cross_product = (current[0] as i64 - previous[0] as i64)
        * (next[1] as i64 - previous[1] as i64)
        - (current[1] as i64 - previous[1] as i64) * (next[0] as i64 - previous[0] as i64);

    if cross_product != 0 {
        return false;
    }

    let min_x = previous[0].min(next[0]);
    let max_x = previous[0].max(next[0]);
    let min_y = previous[1].min(next[1]);
    let max_y = previous[1].max(next[1]);

    current[0] >= min_x && current[0] <= max_x && current[1] >= min_y && current[1] <= max_y
}

fn distance_from_point_to_segment(
    point_x: f64,
    point_y: f64,
    start_x: f64,
    start_y: f64,
    end_x: f64,
    end_y: f64,
) -> f64 {
    let delta_x = end_x - start_x;
    let delta_y = end_y - start_y;

    if delta_x == 0.0 && delta_y == 0.0 {
        return f64::hypot(point_x - start_x, point_y - start_y);
    }

    let projection = ((point_x - start_x) * delta_x + (point_y - start_y) * delta_y)
        / (delta_x * delta_x + delta_y * delta_y);
    let clamped_projection = projection.clamp(0.0, 1.0);
    let nearest_x = start_x + delta_x * clamped_projection;
    let nearest_y = start_y + delta_y * clamped_projection;

    f64::hypot(point_x - nearest_x, point_y - nearest_y)
}

fn add_coverage_for_disc(
    coverage: &mut HashSet<usize>,
    center_x: f64,
    center_y: f64,
    radius: f64,
    dimensions: RasterDimensions,
) {
    let min_x = (center_x - radius - 1.0).floor().max(0.0) as i32;
    let max_x = (center_x + radius)
        .ceil()
        .min((dimensions.width.saturating_sub(1)) as f64) as i32;
    let min_y = (center_y - radius - 1.0).floor().max(0.0) as i32;
    let max_y = (center_y + radius)
        .ceil()
        .min((dimensions.height.saturating_sub(1)) as f64) as i32;

    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let pixel_center_x = x as f64 + 0.5;
            let pixel_center_y = y as f64 + 0.5;

            if f64::hypot(pixel_center_x - center_x, pixel_center_y - center_y) <= radius {
                coverage.insert((y as usize) * dimensions.width as usize + x as usize);
            }
        }
    }
}

fn add_coverage_for_segment(
    coverage: &mut HashSet<usize>,
    start: DrawingPoint,
    end: DrawingPoint,
    radius: f64,
    dimensions: RasterDimensions,
) {
    let min_x = ((start[0].min(end[0]) as f64) - radius - 1.0)
        .floor()
        .max(0.0) as i32;
    let max_x = ((start[0].max(end[0]) as f64) + radius)
        .ceil()
        .min((dimensions.width.saturating_sub(1)) as f64) as i32;
    let min_y = ((start[1].min(end[1]) as f64) - radius - 1.0)
        .floor()
        .max(0.0) as i32;
    let max_y = ((start[1].max(end[1]) as f64) + radius)
        .ceil()
        .min((dimensions.height.saturating_sub(1)) as f64) as i32;

    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let pixel_center_x = x as f64 + 0.5;
            let pixel_center_y = y as f64 + 0.5;

            if distance_from_point_to_segment(
                pixel_center_x,
                pixel_center_y,
                start[0] as f64,
                start[1] as f64,
                end[0] as f64,
                end[1] as f64,
            ) <= radius
            {
                coverage.insert((y as usize) * dimensions.width as usize + x as usize);
            }
        }
    }
}

fn get_disc_coverage_pixel_indices(
    point: [f64; 2],
    brush_size: u32,
    dimensions: RasterDimensions,
) -> Vec<usize> {
    let mut coverage = HashSet::new();
    add_coverage_for_disc(
        &mut coverage,
        point[0],
        point[1],
        brush_size as f64 / 2.0 + PIXEL_CENTER_MARGIN,
        dimensions,
    );
    let mut indices = coverage.into_iter().collect::<Vec<_>>();
    indices.sort_unstable();
    indices
}

fn get_raster_coverage_pixel_indices(
    stroke: &DrawingStroke,
    dimensions: RasterDimensions,
) -> Vec<usize> {
    let mut coverage = HashSet::new();
    let radius = stroke.size as f64 / 2.0 + PIXEL_CENTER_MARGIN;

    if stroke.points.len() == 1 {
        add_coverage_for_disc(
            &mut coverage,
            stroke.points[0][0] as f64,
            stroke.points[0][1] as f64,
            radius,
            dimensions,
        );
        let mut indices = coverage.into_iter().collect::<Vec<_>>();
        indices.sort_unstable();
        return indices;
    }

    for index in 0..stroke.points.len() - 1 {
        add_coverage_for_segment(
            &mut coverage,
            stroke.points[index],
            stroke.points[index + 1],
            radius,
            dimensions,
        );
    }

    let mut indices = coverage.into_iter().collect::<Vec<_>>();
    indices.sort_unstable();
    indices
}

fn sample_stroke_centerline(stroke: &DrawingStroke) -> Vec<StrokeSample> {
    if stroke.points.len() == 1 {
        return vec![StrokeSample {
            distance: 0.0,
            point: [stroke.points[0][0] as f64, stroke.points[0][1] as f64],
        }];
    }

    let mut samples = Vec::new();
    let mut cumulative_distance = 0.0;

    for index in 0..stroke.points.len() - 1 {
        let start = stroke.points[index];
        let end = stroke.points[index + 1];
        let segment_length = f64::hypot(
            end[0] as f64 - start[0] as f64,
            end[1] as f64 - start[1] as f64,
        );

        if index == 0 {
            samples.push(StrokeSample {
                distance: 0.0,
                point: [start[0] as f64, start[1] as f64],
            });
        }

        if segment_length == 0.0 {
            continue;
        }

        let sample_count = (segment_length / SAMPLE_STEP).ceil().max(1.0) as u32;
        for sample_index in 1..=sample_count {
            let t = sample_index as f64 / sample_count as f64;
            samples.push(StrokeSample {
                distance: cumulative_distance + segment_length * t,
                point: [
                    start[0] as f64 + (end[0] as f64 - start[0] as f64) * t,
                    start[1] as f64 + (end[1] as f64 - start[1] as f64) * t,
                ],
            });
        }

        cumulative_distance += segment_length;
    }

    samples
}

fn get_visible_intervals(
    samples: &[StrokeSample],
    visibility: &[bool],
) -> Vec<StrokeFragmentInterval> {
    let mut intervals = Vec::new();
    let mut current_start = None;

    for index in 0..samples.len() {
        if visibility[index] && current_start.is_none() {
            current_start = Some(samples[index].distance);
        }

        let should_close =
            current_start.is_some() && (!visibility[index] || index == samples.len() - 1);
        if !should_close {
            continue;
        }

        let start_distance = current_start.expect("current start should be present");
        let end_distance = if visibility[index] {
            samples[index].distance
        } else {
            samples
                .get(index.wrapping_sub(1))
                .map(|sample| sample.distance)
                .unwrap_or(start_distance)
        };
        if end_distance >= start_distance {
            intervals.push(StrokeFragmentInterval {
                start_distance,
                end_distance,
            });
        }
        current_start = None;
    }

    intervals
}

fn build_stroke_distance_map(stroke: &DrawingStroke) -> Vec<f64> {
    let mut distances = vec![0.0];

    for index in 1..stroke.points.len() {
        let previous = stroke.points[index - 1];
        let current = stroke.points[index];
        distances.push(
            distances[index - 1]
                + f64::hypot(
                    current[0] as f64 - previous[0] as f64,
                    current[1] as f64 - previous[1] as f64,
                ),
        );
    }

    distances
}

fn point_at_distance(
    stroke: &DrawingStroke,
    distances: &[f64],
    distance: f64,
    dimensions: RasterDimensions,
) -> DrawingPoint {
    if stroke.points.len() == 1 {
        return stroke.points[0];
    }

    let total_length = *distances.last().unwrap_or(&0.0);
    if distance <= 0.0 {
        return stroke.points[0];
    }
    if distance >= total_length {
        return *stroke
            .points
            .last()
            .expect("stroke points should not be empty");
    }

    for index in 1..distances.len() {
        let previous_distance = distances[index - 1];
        let current_distance = distances[index];
        if distance > current_distance {
            continue;
        }

        let start = stroke.points[index - 1];
        let end = stroke.points[index];
        let segment_length = current_distance - previous_distance;
        let t = if segment_length == 0.0 {
            0.0
        } else {
            (distance - previous_distance) / segment_length
        };

        return clamp_drawing_point(
            [
                start[0] as f64 + (end[0] as f64 - start[0] as f64) * t,
                start[1] as f64 + (end[1] as f64 - start[1] as f64) * t,
            ],
            dimensions,
        );
    }

    *stroke
        .points
        .last()
        .expect("stroke points should not be empty")
}

fn clamp_drawing_point(point: [f64; 2], dimensions: RasterDimensions) -> DrawingPoint {
    [
        point[0].round().clamp(0.0, dimensions.width as f64) as u32,
        point[1].round().clamp(0.0, dimensions.height as f64) as u32,
    ]
}

fn build_stroke_fragments(
    stroke: &DrawingStroke,
    intervals: &[StrokeFragmentInterval],
    dimensions: RasterDimensions,
) -> Vec<DrawingStroke> {
    if stroke.points.len() == 1 {
        return if intervals.is_empty() {
            Vec::new()
        } else {
            vec![stroke.clone()]
        };
    }

    let distances = build_stroke_distance_map(stroke);
    let mut fragments = Vec::new();

    for interval in intervals {
        let mut next_points = Vec::new();
        let start_point =
            point_at_distance(stroke, &distances, interval.start_distance, dimensions);
        let end_point = point_at_distance(stroke, &distances, interval.end_distance, dimensions);

        next_points.push(start_point);

        for (index, distance) in distances
            .iter()
            .enumerate()
            .take(stroke.points.len() - 1)
            .skip(1)
        {
            if *distance <= interval.start_distance || *distance >= interval.end_distance {
                continue;
            }

            next_points.push(stroke.points[index]);
        }

        if next_points.last().copied() != Some(end_point) {
            next_points.push(end_point);
        }

        let deduped_points = dedupe_consecutive_points(&next_points);
        if deduped_points.is_empty() {
            continue;
        }

        fragments.push(DrawingStroke {
            color: stroke.color.clone(),
            size: stroke.size,
            points: deduped_points,
        });
    }

    fragments
}

fn build_ownership_buffer(
    strokes: &[DrawingStroke],
    dimensions: RasterDimensions,
) -> (Vec<Vec<usize>>, Vec<i32>) {
    let mut owner_by_pixel = vec![-1; dimensions.width as usize * dimensions.height as usize];
    let coverage_by_stroke = strokes
        .iter()
        .map(|stroke| get_raster_coverage_pixel_indices(stroke, dimensions))
        .collect::<Vec<_>>();

    for (stroke_index, coverage) in coverage_by_stroke.iter().enumerate() {
        for pixel_index in coverage {
            owner_by_pixel[*pixel_index] = stroke_index as i32;
        }
    }

    (coverage_by_stroke, owner_by_pixel)
}

fn is_sample_hidden(
    sample: &StrokeSample,
    stroke_index: usize,
    stroke: &DrawingStroke,
    owner_by_pixel: &[i32],
    dimensions: RasterDimensions,
) -> bool {
    for pixel_index in get_disc_coverage_pixel_indices(sample.point, stroke.size, dimensions) {
        if owner_by_pixel[pixel_index] <= stroke_index as i32 {
            return false;
        }
    }

    true
}

fn coverage_difference_is_hidden(
    original_coverage: &[usize],
    candidate_coverage: &[usize],
    owner_by_pixel: &[i32],
    stroke_index: usize,
) -> bool {
    let original_set = original_coverage.iter().copied().collect::<HashSet<_>>();
    let candidate_set = candidate_coverage.iter().copied().collect::<HashSet<_>>();

    for pixel_index in original_coverage {
        if !candidate_set.contains(pixel_index)
            && owner_by_pixel[*pixel_index] <= stroke_index as i32
        {
            return false;
        }
    }

    for pixel_index in candidate_coverage {
        if !original_set.contains(pixel_index)
            && owner_by_pixel[*pixel_index] <= stroke_index as i32
        {
            return false;
        }
    }

    true
}

fn collect_candidate_coverage(
    fragments: &[DrawingStroke],
    dimensions: RasterDimensions,
) -> Vec<usize> {
    let mut coverage = HashSet::new();

    for fragment in fragments {
        for pixel_index in get_raster_coverage_pixel_indices(fragment, dimensions) {
            coverage.insert(pixel_index);
        }
    }

    let mut indices = coverage.into_iter().collect::<Vec<_>>();
    indices.sort_unstable();
    indices
}

fn serialized_stroke_bytes(strokes: &[DrawingStroke]) -> usize {
    serde_json::to_vec(strokes)
        .map(|bytes| bytes.len())
        .unwrap_or(usize::MAX)
}

#[allow(dead_code)]
pub(crate) fn serialize_lossless_document_json(
    document: &DrawingDocumentV2,
) -> Result<Vec<u8>, StrokeJsonError> {
    serialize_document_v2(document)
}
