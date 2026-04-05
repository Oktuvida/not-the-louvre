use stroke_json_core::{
    DrawingDocumentKind, DrawingStroke, PreparePublishOptions, StrokeJsonError,
    normalize_drawing_stroke_exactly, prepare_publish_document, prepare_storage_document,
    run_exact_raster_oracle, serialize_canonical_document,
};

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

    let result = run_exact_raster_oracle(document_json.as_bytes(), Default::default())
        .expect("exact raster oracle should succeed");

    assert_eq!(result.document.kind, DrawingDocumentKind::Artwork);
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
fn publish_preparation_accepts_oversized_raw_strokes_when_the_prepared_payload_fits_limits() {
    let repeated_points = std::iter::repeat_n("[120,120]", 2_500)
        .collect::<Vec<_>>()
        .join(",");
    let document_json = format!(
        "{{\"version\":1,\"kind\":\"artwork\",\"width\":768,\"height\":768,\"background\":\"#fdfbf7\",\"strokes\":[{{\"color\":\"#2d2420\",\"size\":4,\"points\":[{repeated_points},[640,120]]}}]}}"
    );

    let prepared = prepare_publish_document(
        document_json.as_bytes(),
        PreparePublishOptions::default(),
    )
    .expect(
        "publish preparation should compact oversized raw strokes before enforcing final limits",
    );

    assert_eq!(prepared.document.base.len(), 0);
    assert_eq!(prepared.document.tail.len(), 1);
    assert!(prepared.document.tail[0].points.len() <= 2_000);
}

#[test]
fn storage_preparation_does_not_replay_publish_compaction_for_prepared_v2_documents() {
    let editable_document = format!(
        "{{\"version\":2,\"kind\":\"artwork\",\"width\":768,\"height\":768,\"background\":\"#fdfbf7\",\"base\":[{}],\"tail\":[{},{}]}}",
        create_stroke(10, 500),
        create_stroke(210, 600),
        create_stroke(410, 450)
    );
    let prepared = prepare_publish_document(
        editable_document.as_bytes(),
        PreparePublishOptions::default(),
    )
    .expect("publish preparation should succeed");
    let prepared_json = String::from_utf8(
        serialize_canonical_document(
            serde_json::to_string(&prepared.document)
                .expect("prepared document should serialize")
                .as_bytes(),
        )
        .expect("prepared document should canonicalize"),
    )
    .expect("prepared canonical document should be utf-8");

    let stored = prepare_storage_document(prepared_json.as_bytes())
        .expect("prepared document should remain acceptable for storage");

    assert_eq!(
        String::from_utf8(stored.canonical_json).unwrap(),
        prepared_json
    );
}
