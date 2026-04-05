#[cfg(target_arch = "wasm32")]
use stroke_json_wasm::run_prod_like_pipeline;

#[cfg(target_arch = "wasm32")]
fn phase1_reference_document() -> &'static str {
    r##"{"background":"#fdfbf7","base":[{"color":"#2d2420","points":[[10,10],[20,20],[30,30],[40,40],[50,50]],"size":4}],"height":768,"kind":"artwork","tail":[],"version":2,"width":768}"##
}

#[test]
#[cfg(target_arch = "wasm32")]
fn prod_like_pipeline_binding_returns_final_document_and_iterations() {
    let prepared = run_prod_like_pipeline(
        phase1_reference_document().as_bytes(),
        Some("{\"iterationCount\":2}".to_string()),
    )
    .expect("prod-like pipeline should succeed");

    assert_eq!(prepared.version, 2);
    assert_eq!(prepared.kind, "artwork");
    assert_eq!(prepared.width, 768);
    assert_eq!(prepared.height, 768);
    assert_eq!(prepared.stroke_count, 1);
    assert_eq!(prepared.total_points, 2);
    assert_eq!(prepared.iterations.length(), 2);
    assert!(prepared.total_duration_ms > 0.0);
    assert!(!prepared.final_document_json.is_empty());
}
