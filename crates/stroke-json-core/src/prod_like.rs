use std::collections::HashSet;

#[cfg(not(target_arch = "wasm32"))]
use std::time::Instant;

#[cfg(target_arch = "wasm32")]
use js_sys::{Date, Function, Reflect};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{JsCast, JsValue};

use clipper2_rust::{
    EndType, JoinType, Path64, Paths64, Point64, PointInPolygonResult, inflate_paths_64,
    point_in_polygon,
};
use serde::{Deserialize, Serialize};
use simplify_polyline::{Point as SimplifyPoint, simplify};

use crate::{
    DRAWING_DOCUMENT_V2_VERSION, DrawingDocument, DrawingDocumentV2, DrawingStroke,
    LosslessCompactionOptions, StrokeJsonError, gzip_canonical_json,
    normalize_document_to_canonical_v2, normalize_drawing_stroke_exactly,
    parse_and_validate_document, serialize_document_v2,
};

const CLIPPER_SIMPLIFY_EPSILON: f64 = 0.01;
const DOT_POLYGON_STEPS: usize = 24;
const GEOMETRY_SCALE: i64 = 2;
const SAMPLE_STEP: f64 = 0.5;

pub const PROD_LIKE_PIPELINE_ITERATION_COUNT: u32 = 20;
pub const PROD_LIKE_PHASE1_ALGORITHM_ID: &str = "simplify-js";
pub const PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE: f64 = 0.5;
pub const PROD_LIKE_PHASE1_HIGH_QUALITY: bool = true;
pub const PROD_LIKE_PHASE2_ENGINE_ID: &str = "clipper2-rust";

type DrawingPoint = [u32; 2];

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProdLikePipelineOptions {
    pub iteration_count: Option<u32>,
    pub phase2_max_stroke_coverage_pixels: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProdLikePipelineIterationResult {
    pub document: DrawingDocumentV2,
    pub duration_ms: f64,
    pub gzip_bytes: u32,
    pub pass_number: u32,
    pub raw_bytes: u32,
    pub stroke_count: u32,
    pub total_points: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProdLikePipelineResult {
    pub baseline_document: DrawingDocumentV2,
    pub final_document: DrawingDocumentV2,
    pub iterations: Vec<ProdLikePipelineIterationResult>,
    pub total_duration_ms: f64,
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

pub fn simplify_document_with_simplify_polyline(
    document_json: &[u8],
) -> Result<DrawingDocumentV2, StrokeJsonError> {
    let document = parse_and_validate_document(document_json)?;
    Ok(simplify_document_to_v2(
        &normalize_document_to_canonical_v2(&document),
    ))
}

pub fn compact_document_with_clipper2(
    document_json: &[u8],
    options: LosslessCompactionOptions,
) -> Result<DrawingDocumentV2, StrokeJsonError> {
    let document = parse_and_validate_document(document_json)?;
    Ok(compact_document_with_clipper2_from_v2(
        &normalize_document_for_phase2(&document),
        options,
    ))
}

pub fn run_prod_like_pipeline(
    document_json: &[u8],
    options: ProdLikePipelineOptions,
) -> Result<ProdLikePipelineResult, StrokeJsonError> {
    let document = parse_and_validate_document(document_json)?;
    let baseline_document = normalize_document_to_canonical_v2(&document);
    let mut current_document = baseline_document.clone();
    let iteration_count = options
        .iteration_count
        .unwrap_or(PROD_LIKE_PIPELINE_ITERATION_COUNT)
        .max(1);
    let mut iterations = Vec::with_capacity(iteration_count as usize);

    for pass_number in 1..=iteration_count {
        let (phase2_document, duration_ms) = measure_pass_duration_ms(|| {
            let phase1_document = simplify_document_to_v2(&current_document);
            compact_document_with_clipper2_from_v2(
                &phase1_document,
                LosslessCompactionOptions {
                    max_stroke_coverage_pixels: options.phase2_max_stroke_coverage_pixels,
                },
            )
        });
        let canonical_json = serialize_document_v2(&phase2_document)?;
        let gzip_bytes = gzip_canonical_json(&canonical_json)?.len() as u32;
        let raw_bytes = canonical_json.len() as u32;

        current_document = phase2_document.clone();
        iterations.push(ProdLikePipelineIterationResult {
            document: phase2_document,
            duration_ms,
            gzip_bytes,
            pass_number,
            raw_bytes,
            stroke_count: count_strokes(&current_document),
            total_points: count_points(&current_document),
        });
    }

    let total_duration_ms = round_total_duration_ms(&iterations);

    Ok(ProdLikePipelineResult {
        baseline_document,
        final_document: current_document,
        iterations,
        total_duration_ms,
    })
}

#[cfg(target_arch = "wasm32")]
fn measure_pass_duration_ms<T>(run: impl FnOnce() -> T) -> (T, f64) {
    let started_at = monotonic_now_ms();
    let result = run();
    let finished_at = monotonic_now_ms();
    (
        result,
        round_elapsed_ms((finished_at - started_at).max(0.0)),
    )
}

#[cfg(not(target_arch = "wasm32"))]
fn measure_pass_duration_ms<T>(run: impl FnOnce() -> T) -> (T, f64) {
    let started_at = Instant::now();
    let result = run();
    (result, round_duration_ms(started_at.elapsed()))
}

#[cfg(target_arch = "wasm32")]
fn monotonic_now_ms() -> f64 {
    let global = js_sys::global();
    let performance = Reflect::get(&global, &JsValue::from_str("performance"))
        .ok()
        .filter(|value| !value.is_null() && !value.is_undefined());

    let Some(performance) = performance else {
        return Date::now();
    };

    let now = Reflect::get(&performance, &JsValue::from_str("now"))
        .ok()
        .and_then(|value| value.dyn_into::<Function>().ok())
        .and_then(|function| function.call0(&performance).ok())
        .and_then(|value| value.as_f64());

    now.unwrap_or_else(Date::now)
}

fn simplify_document_to_v2(document: &DrawingDocumentV2) -> DrawingDocumentV2 {
    DrawingDocumentV2 {
        base: document
            .base
            .iter()
            .map(simplify_stroke_with_simplify_polyline)
            .collect(),
        tail: document
            .tail
            .iter()
            .map(simplify_stroke_with_simplify_polyline)
            .collect(),
        ..document.clone()
    }
}

fn simplify_stroke_with_simplify_polyline(stroke: &DrawingStroke) -> DrawingStroke {
    if stroke.points.len() <= 2 {
        return stroke.clone();
    }

    let points = stroke
        .points
        .iter()
        .map(|point| SimplifyPoint {
            vec: [point[0] as f64, point[1] as f64],
        })
        .collect::<Vec<_>>();
    let simplified = simplify::<2, f64>(
        &points,
        PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE,
        PROD_LIKE_PHASE1_HIGH_QUALITY,
    );

    DrawingStroke {
        color: stroke.color.clone(),
        size: stroke.size,
        points: simplified
            .into_iter()
            .map(|point| [point.vec[0].round() as u32, point.vec[1].round() as u32])
            .collect(),
    }
}

fn compact_document_with_clipper2_from_v2(
    document: &DrawingDocumentV2,
    options: LosslessCompactionOptions,
) -> DrawingDocumentV2 {
    let normalized_document = normalize_document_for_phase2(&DrawingDocument::V2(document.clone()));
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
    let mut compacted_groups_in_reverse = Vec::with_capacity(ordered_strokes.len());
    let mut later_occluders: Vec<Path64> = Vec::new();

    for stroke_index in (0..ordered_strokes.len()).rev() {
        let stroke = &ordered_strokes[stroke_index];
        let original_coverage = &coverage_by_stroke[stroke_index];

        let kept_strokes = if original_coverage.is_empty()
            || is_coverage_fully_hidden(original_coverage, &owner_by_pixel, stroke_index)
        {
            Vec::new()
        } else if !later_occluders.is_empty()
            && max_stroke_coverage_pixels.is_some()
            && original_coverage.len() > max_stroke_coverage_pixels.unwrap() as usize
            || later_occluders.is_empty()
            || stroke.points.len() == 1
        {
            vec![stroke.clone()]
        } else {
            let fragments = clip_visible_line_fragments(stroke, &later_occluders, dimensions);
            if fragments.is_empty() {
                vec![stroke.clone()]
            } else if coverage_difference_is_hidden(
                original_coverage,
                &collect_candidate_coverage(&fragments, dimensions),
                &owner_by_pixel,
                stroke_index,
            ) && serialized_stroke_bytes(&fragments)
                < serialized_stroke_bytes(std::slice::from_ref(stroke))
            {
                fragments
            } else {
                vec![stroke.clone()]
            }
        };

        compacted_groups_in_reverse.push(kept_strokes);
        later_occluders.extend(build_occluder_polygons(stroke));
    }

    DrawingDocumentV2 {
        version: DRAWING_DOCUMENT_V2_VERSION,
        kind: normalized_document.kind,
        width: normalized_document.width,
        height: normalized_document.height,
        background: normalized_document.background,
        base: compacted_groups_in_reverse
            .into_iter()
            .rev()
            .flatten()
            .collect(),
        tail: Vec::new(),
    }
}

fn normalize_document_for_phase2(document: &DrawingDocument) -> DrawingDocumentV2 {
    let normalized_document = normalize_document_to_canonical_v2(document);

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

fn build_occluder_polygons(stroke: &DrawingStroke) -> Vec<Path64> {
    if stroke.points.is_empty() {
        return Vec::new();
    }

    if stroke.points.len() == 1 {
        let center = stroke.points[0];
        let radius = stroke.size as f64;
        let polygon = (0..DOT_POLYGON_STEPS)
            .map(|step| {
                let angle = std::f64::consts::TAU * step as f64 / DOT_POLYGON_STEPS as f64;
                Point64::new(
                    ((center[0] as i64 * GEOMETRY_SCALE) as f64 + radius * angle.cos()).round()
                        as i64,
                    ((center[1] as i64 * GEOMETRY_SCALE) as f64 + radius * angle.sin()).round()
                        as i64,
                )
            })
            .collect::<Vec<_>>();

        return vec![polygon];
    }

    let paths: Paths64 = vec![
        stroke
            .points
            .iter()
            .map(|point| {
                Point64::new(
                    point[0] as i64 * GEOMETRY_SCALE,
                    point[1] as i64 * GEOMETRY_SCALE,
                )
            })
            .collect(),
    ];

    inflate_paths_64(
        &paths,
        stroke.size as f64,
        JoinType::Round,
        EndType::Round,
        2.0,
        CLIPPER_SIMPLIFY_EPSILON,
    )
}

fn clip_visible_line_fragments(
    stroke: &DrawingStroke,
    later_occluders: &[Path64],
    dimensions: RasterDimensions,
) -> Vec<DrawingStroke> {
    let samples = sample_stroke_centerline(stroke);
    let visibility = samples
        .iter()
        .map(|sample| !is_geometry_point_hidden(sample.point, later_occluders))
        .collect::<Vec<_>>();
    let intervals = get_visible_intervals(&samples, &visibility);

    build_stroke_fragments(stroke, &intervals, dimensions)
}

fn is_geometry_point_hidden(point: [f64; 2], later_occluders: &[Path64]) -> bool {
    let point = Point64::new(
        (point[0] * GEOMETRY_SCALE as f64).round() as i64,
        (point[1] * GEOMETRY_SCALE as f64).round() as i64,
    );

    later_occluders
        .iter()
        .any(|polygon| point_in_polygon(point, polygon) != PointInPolygonResult::IsOutside)
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

fn is_coverage_fully_hidden(
    coverage: &[usize],
    owner_by_pixel: &[i32],
    stroke_index: usize,
) -> bool {
    coverage
        .iter()
        .all(|pixel_index| owner_by_pixel[*pixel_index] > stroke_index as i32)
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

fn dedupe_consecutive_points(points: &[DrawingPoint]) -> Vec<DrawingPoint> {
    let mut deduped = Vec::new();

    for point in points {
        if deduped.last().copied() != Some(*point) {
            deduped.push(*point);
        }
    }

    deduped
}

fn get_raster_coverage_pixel_indices(
    stroke: &DrawingStroke,
    dimensions: RasterDimensions,
) -> Vec<usize> {
    let mut coverage = HashSet::new();
    let radius = stroke.size as f64 / 2.0 + std::f64::consts::SQRT_2 / 2.0;

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

fn count_strokes(document: &DrawingDocumentV2) -> u32 {
    (document.base.len() + document.tail.len()) as u32
}

fn count_points(document: &DrawingDocumentV2) -> u32 {
    document
        .base
        .iter()
        .chain(document.tail.iter())
        .map(|stroke| stroke.points.len() as u32)
        .sum()
}

#[cfg(not(target_arch = "wasm32"))]
fn round_duration_ms(duration: std::time::Duration) -> f64 {
    ((duration.as_secs_f64() * 1000.0) * 100.0).round() / 100.0
}

#[cfg(target_arch = "wasm32")]
fn round_elapsed_ms(duration_ms: f64) -> f64 {
    (duration_ms * 100.0).round() / 100.0
}

fn round_total_duration_ms(iterations: &[ProdLikePipelineIterationResult]) -> f64 {
    (iterations
        .iter()
        .map(|iteration| iteration.duration_ms)
        .sum::<f64>()
        * 100.0)
        .round()
        / 100.0
}
