use stroke_json_core::{
    DrawingDocumentKind, StrokeJsonError, StrokeJsonPreparedStorageDocument,
    decode_canonical_document, decode_editable_document, normalize_editable_document,
    prepare_storage_document, serialize_canonical_document, validate_document,
};

fn artwork_v1_document() -> &'static str {
    r##"{"version":1,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","strokes":[{"color":"#2d2420","size":5,"points":[[10,12],[24,32]]}]}"##
}

fn artwork_v2_editable_document() -> &'static str {
    r##"{"version":2,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","base":[],"tail":[{"color":"#2d2420","size":5,"points":[[10,12],[24,32]]}]}"##
}

fn artwork_v2_prepared_document() -> &'static str {
    r##"{"version":2,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","base":[{"color":"#2d2420","size":5,"points":[[10,12],[24,32]]}],"tail":[]}"##
}

fn prepared_storage_document(document_json: &str) -> StrokeJsonPreparedStorageDocument {
    prepare_storage_document(document_json.as_bytes()).expect("storage document should prepare")
}

#[test]
fn validates_v1_documents_and_reports_metadata() {
    let metadata = validate_document(artwork_v1_document().as_bytes()).expect("valid v1 document");

    assert_eq!(metadata.version, 1);
    assert_eq!(metadata.kind, DrawingDocumentKind::Artwork);
    assert_eq!(metadata.width, 768);
    assert_eq!(metadata.height, 768);
    assert_eq!(metadata.stroke_count, 1);
    assert_eq!(metadata.total_points, 2);
}

#[test]
fn rejects_semantically_invalid_documents() {
    let invalid_document = r##"{"version":1,"kind":"artwork","width":768,"height":768,"background":"#fdfbf7","strokes":[{"color":"#2d2420","size":5,"points":[]}]}"##;

    let error = validate_document(invalid_document.as_bytes()).expect_err("invalid document");

    assert!(matches!(error, StrokeJsonError::InvalidDocument { .. }));
    assert!(error.to_string().contains("at least one point"));
}

#[test]
fn normalizes_v1_documents_into_editable_v2_tail_state() {
    let normalized = normalize_editable_document(artwork_v1_document().as_bytes())
        .expect("editable normalization should succeed");

    assert_eq!(
        String::from_utf8(normalized).unwrap(),
        artwork_v2_editable_document()
    );
}

#[test]
fn canonical_serialization_emits_minified_v2_json() {
    let canonical = serialize_canonical_document(artwork_v1_document().as_bytes())
        .expect("canonical serialization should succeed");

    assert_eq!(
        String::from_utf8(canonical).unwrap(),
        artwork_v2_prepared_document()
    );
}

#[test]
fn storage_preparation_keeps_legacy_v1_compatible_with_decode_modes() {
    let prepared = prepared_storage_document(artwork_v1_document());

    assert_eq!(
        String::from_utf8(prepared.canonical_json.clone()).unwrap(),
        artwork_v2_prepared_document()
    );
    assert_eq!(prepared.version, 2);
    assert_eq!(prepared.kind, DrawingDocumentKind::Artwork);
    assert_eq!(prepared.stroke_count, 1);
    assert_eq!(prepared.total_points, 2);

    let editable = decode_editable_document(&prepared.compressed_bytes)
        .expect("editable decode should succeed");
    let canonical = decode_canonical_document(&prepared.compressed_bytes)
        .expect("canonical decode should succeed");

    assert_eq!(
        String::from_utf8(editable).unwrap(),
        artwork_v2_prepared_document()
    );
    assert_eq!(
        String::from_utf8(canonical).unwrap(),
        artwork_v2_prepared_document()
    );
}

#[test]
fn canonical_decode_preserves_already_prepared_v2_structure() {
    let prepared = prepared_storage_document(artwork_v2_prepared_document());
    let decoded = decode_canonical_document(&prepared.compressed_bytes)
        .expect("canonical decode should succeed");

    assert_eq!(
        String::from_utf8(decoded).unwrap(),
        artwork_v2_prepared_document()
    );
}
