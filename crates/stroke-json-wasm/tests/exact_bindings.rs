use stroke_json_wasm::{compact_document_losslessly_with_report, prepare_publish_document};

fn overlapping_document() -> &'static str {
    r##"{"version":2,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","base":[{"color":"#2d2420","size":6,"points":[[48,120],[720,120]]}],"tail":[{"color":"#c84f4f","size":18,"points":[[48,120],[720,120]]}]}"##
}

fn oversized_but_compactable_document() -> String {
    let repeated_points = std::iter::repeat_n("[120,120]", 2_500)
        .collect::<Vec<_>>()
        .join(",");

    format!(
        "{{\"version\":1,\"kind\":\"artwork\",\"width\":768,\"height\":768,\"background\":\"#fdfbf7\",\"strokes\":[{{\"color\":\"#2d2420\",\"size\":4,\"points\":[{repeated_points},[640,120]]}}]}}"
    )
}

#[test]
fn prepare_publish_binding_returns_rust_owned_metadata() {
    let prepared = prepare_publish_document(overlapping_document().as_bytes(), None)
        .expect("publish preparation should succeed");

    assert_eq!(prepared.version, 2);
    assert_eq!(prepared.kind, "artwork");
    assert_eq!(prepared.width, 768);
    assert_eq!(prepared.height, 768);
    assert!(prepared.total_points > 0);
    assert!(!prepared.document_json.is_empty());
}

#[test]
fn prepare_publish_binding_accepts_oversized_raw_strokes_when_the_prepared_payload_fits_limits() {
    let prepared = prepare_publish_document(oversized_but_compactable_document().as_bytes(), None)
        .expect("publish preparation should succeed for oversized raw strokes once the prepared payload fits limits");

    assert_eq!(prepared.version, 2);
    assert_eq!(prepared.kind, "artwork");
    assert!(prepared.total_points <= 2_000);
    assert!(!prepared.document_json.is_empty());
}

#[test]
fn lossless_compaction_binding_uses_real_compaction_report() {
    let prepared = compact_document_losslessly_with_report(overlapping_document().as_bytes(), None)
        .expect("lossless compaction should succeed");

    assert_eq!(prepared.version, 2);
    assert_eq!(prepared.kind, "artwork");
    assert_eq!(prepared.width, 768);
    assert_eq!(prepared.height, 768);
    assert_eq!(prepared.stroke_count, 1);
    assert!(!prepared.document_json.is_empty());
}
