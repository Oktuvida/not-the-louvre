use stroke_json_core::{
    StrokeJsonDocumentLimits, StrokeJsonError, prepare_storage_document_with_limits,
    validate_document,
};

fn artwork_document_with_strokes(stroke_count: usize, points_per_stroke: usize) -> Vec<u8> {
    let stroke = format!(
        r##"{{"color":"#2d2420","size":5,"points":[{}]}}"##,
        std::iter::repeat_n("[12,24]", points_per_stroke)
            .collect::<Vec<_>>()
            .join(",")
    );

    format!(
        r##"{{"version":1,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","strokes":[{}]}}"##,
        std::iter::repeat_n(stroke.as_str(), stroke_count)
            .collect::<Vec<_>>()
            .join(",")
    )
    .into_bytes()
}

#[test]
fn default_limits_keep_stroke_count_and_points_per_stroke_at_5000() {
    let limits = StrokeJsonDocumentLimits::default();

    assert_eq!(limits.max_points_per_stroke, 5_000);
    assert_eq!(limits.max_strokes, 5_000);
}

#[test]
fn validate_document_accepts_5000_strokes_and_rejects_5001() {
    let accepted = artwork_document_with_strokes(5_000, 1);
    let rejected = artwork_document_with_strokes(5_001, 1);

    validate_document(&accepted).expect("5000 strokes should remain valid");

    let error = validate_document(&rejected).expect_err("5001 strokes should fail");
    assert!(matches!(
        error,
        StrokeJsonError::DocumentLimitsExceeded { .. }
    ));
    assert!(error.to_string().contains("max strokes of 5000"));
}

#[test]
fn validate_document_accepts_5000_points_per_stroke_and_rejects_5001() {
    let accepted = artwork_document_with_strokes(1, 5_000);
    let rejected = artwork_document_with_strokes(1, 5_001);

    validate_document(&accepted).expect("5000 points per stroke should remain valid");

    let error = validate_document(&rejected).expect_err("5001 points per stroke should fail");
    assert!(matches!(
        error,
        StrokeJsonError::DocumentLimitsExceeded { .. }
    ));
    assert!(error.to_string().contains("max points per stroke of 5000"));
}

#[test]
fn validate_document_defers_byte_limits_to_storage_payload_checks() {
    let document = artwork_document_with_strokes(100, 10);

    validate_document(&document).expect("shape and point limits should remain valid");

    let error = prepare_storage_document_with_limits(
        &document,
        StrokeJsonDocumentLimits {
            max_decompressed_bytes: 1_024,
            ..StrokeJsonDocumentLimits::default()
        },
    )
    .expect_err("final storage payload byte limit should fail");

    assert!(matches!(
        error,
        StrokeJsonError::DocumentLimitsExceeded { .. }
    ));
    assert!(error.to_string().contains("max decompressed bytes of 1024"));
}
