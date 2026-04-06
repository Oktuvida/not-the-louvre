use stroke_json_core::{
    LosslessCompactionOptions, PROD_LIKE_PHASE1_ALGORITHM_ID, PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE,
    PROD_LIKE_PHASE2_ENGINE_ID, PROD_LIKE_PIPELINE_ITERATION_COUNT, ProdLikePipelineOptions,
    compact_document_with_clipper2, run_prod_like_pipeline,
    simplify_document_with_simplify_polyline,
};

fn parse_json(json: &str) -> serde_json::Value {
    serde_json::from_str(json).expect("fixture JSON should parse")
}

const PHASE1_INPUT: &str = include_str!("fixtures/prod_like_phase1.input.json");
const PHASE1_EXPECTED: &str = include_str!("fixtures/prod_like_phase1.expected.json");
const PHASE2_INPUT: &str = include_str!("fixtures/prod_like_phase2.input.json");
const PHASE2_UNCAPPED_EXPECTED: &str =
    include_str!("fixtures/prod_like_phase2.expected.uncapped.json");
const PHASE2_CAPPED_EXPECTED: &str = include_str!("fixtures/prod_like_phase2.expected.capped.json");

#[test]
fn prod_like_constants_match_approved_defaults() {
    assert_eq!(PROD_LIKE_PIPELINE_ITERATION_COUNT, 20);
    assert_eq!(PROD_LIKE_PHASE1_ALGORITHM_ID, "simplify-js");
    assert_eq!(PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE, 0.5);
    assert_eq!(PROD_LIKE_PHASE2_ENGINE_ID, "clipper2-rust");
}

#[test]
fn phase1_matches_the_typescript_reference_fixture() {
    let simplified = simplify_document_with_simplify_polyline(PHASE1_INPUT.trim().as_bytes())
        .expect("phase 1 simplification should succeed");

    assert_eq!(
        serde_json::to_value(&simplified).unwrap(),
        parse_json(PHASE1_EXPECTED.trim())
    );
}

#[test]
fn phase2_matches_the_typescript_reference_for_capped_and_uncapped_runs() {
    let uncapped = compact_document_with_clipper2(
        PHASE2_INPUT.trim().as_bytes(),
        LosslessCompactionOptions::default(),
    )
    .expect("uncapped phase 2 compaction should succeed");
    let capped = compact_document_with_clipper2(
        PHASE2_INPUT.trim().as_bytes(),
        LosslessCompactionOptions {
            max_stroke_coverage_pixels: Some(1),
        },
    )
    .expect("capped phase 2 compaction should succeed");

    assert_eq!(
        serde_json::to_value(&uncapped).unwrap(),
        parse_json(PHASE2_UNCAPPED_EXPECTED.trim())
    );
    assert_eq!(
        serde_json::to_value(&capped).unwrap(),
        parse_json(PHASE2_CAPPED_EXPECTED.trim())
    );
}

#[test]
fn prod_like_pipeline_matches_reference_documents_and_metrics() {
    let result = run_prod_like_pipeline(
        PHASE1_INPUT.trim().as_bytes(),
        ProdLikePipelineOptions {
            iteration_count: Some(2),
            ..ProdLikePipelineOptions::default()
        },
    )
    .expect("prod-like pipeline should succeed");

    assert_eq!(
        serde_json::to_value(&result.baseline_document).unwrap(),
        parse_json(PHASE1_INPUT.trim())
    );
    assert_eq!(
        serde_json::to_value(&result.final_document).unwrap(),
        parse_json(PHASE1_EXPECTED.trim())
    );
    assert_eq!(result.iterations.len(), 2);
    assert_eq!(
        serde_json::to_value(&result.iterations[0].document).unwrap(),
        parse_json(PHASE1_EXPECTED.trim())
    );
    assert_eq!(
        serde_json::to_value(&result.iterations[1].document).unwrap(),
        parse_json(PHASE1_EXPECTED.trim())
    );
    assert_eq!(result.iterations[0].raw_bytes, 153);
    assert!(result.iterations[0].gzip_bytes > 0);
    assert_eq!(result.iterations[0].stroke_count, 1);
    assert_eq!(result.iterations[0].total_points, 2);
    assert_eq!(result.iterations[1].raw_bytes, 153);
    assert_eq!(
        result.iterations[1].gzip_bytes,
        result.iterations[0].gzip_bytes
    );
    assert_eq!(result.iterations[1].stroke_count, 1);
    assert_eq!(result.iterations[1].total_points, 2);
    assert!(result.iterations[0].duration_ms >= 0.0);
    assert!(result.iterations[1].duration_ms >= 0.0);
    assert!(result.total_duration_ms >= 0.0);
}
