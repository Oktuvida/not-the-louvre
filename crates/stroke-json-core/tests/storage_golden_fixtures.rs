use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use stroke_json_core::{
    StrokeJsonDocumentLimits, StrokeJsonError, decode_canonical_document, prepare_storage_document,
    prepare_storage_document_with_limits,
};

type Fixture = (&'static str, &'static str, &'static str, &'static str);

const FIXTURES: &[Fixture] = &[
    (
        "legacy_v1",
        include_str!("fixtures/legacy_v1.input.json"),
        include_str!("fixtures/legacy_v1.canonical.json"),
        include_str!("fixtures/legacy_v1.storage.base64"),
    ),
    (
        "editable_v2",
        include_str!("fixtures/editable_v2.input.json"),
        include_str!("fixtures/editable_v2.canonical.json"),
        include_str!("fixtures/editable_v2.storage.base64"),
    ),
    (
        "prepared_v2",
        include_str!("fixtures/prepared_v2.input.json"),
        include_str!("fixtures/prepared_v2.canonical.json"),
        include_str!("fixtures/prepared_v2.storage.base64"),
    ),
];

#[test]
fn storage_preparation_matches_golden_fixtures() {
    for (name, input_json, canonical_json, storage_base64) in FIXTURES {
        let prepared = prepare_storage_document(input_json.trim().as_bytes())
            .unwrap_or_else(|error| panic!("fixture {name} should prepare: {error}"));
        let decoded = decode_canonical_document(&prepared.compressed_bytes)
            .unwrap_or_else(|error| panic!("fixture {name} should decode: {error}"));
        let fixture_payload = STANDARD
            .decode(storage_base64.trim())
            .unwrap_or_else(|error| panic!("fixture {name} base64 should decode: {error}"));
        let fixture_decoded = decode_canonical_document(&fixture_payload)
            .unwrap_or_else(|error| panic!("fixture {name} golden payload should decode: {error}"));
        let emitted_base64 = STANDARD.encode(&prepared.compressed_bytes);
        let emitted_roundtrip = STANDARD.decode(emitted_base64).unwrap_or_else(|error| {
            panic!("fixture {name} emitted payload should re-decode: {error}")
        });

        assert_eq!(
            String::from_utf8(prepared.canonical_json).unwrap(),
            canonical_json.trim()
        );
        assert_eq!(String::from_utf8(decoded).unwrap(), canonical_json.trim());
        assert_eq!(
            String::from_utf8(fixture_decoded).unwrap(),
            canonical_json.trim()
        );
        assert_eq!(emitted_roundtrip, prepared.compressed_bytes);
    }
}

#[test]
fn storage_preparation_enforces_compressed_byte_limits() {
    let error = prepare_storage_document_with_limits(
        include_str!("fixtures/prepared_v2.input.json")
            .trim()
            .as_bytes(),
        StrokeJsonDocumentLimits {
            max_compressed_bytes: 32,
            ..StrokeJsonDocumentLimits::default()
        },
    )
    .expect_err("compressed byte limit should fail");

    assert!(matches!(
        error,
        StrokeJsonError::DocumentLimitsExceeded { .. }
    ));
    assert!(error.to_string().contains("max compressed bytes"));
}
