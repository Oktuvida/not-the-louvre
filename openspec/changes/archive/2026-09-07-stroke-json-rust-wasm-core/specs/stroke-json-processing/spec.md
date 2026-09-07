## ADDED Requirements

### Requirement: Rust-owned document validation and explicit normalization
The system SHALL implement stroke-json document parsing, semantic validation, and versioned normalization in Rust, and SHALL expose explicit editable and canonical normalization operations rather than relying on TypeScript-side authority for those rules.

#### Scenario: Editable hydration normalizes legacy V1 into editable V2 tail state
- **WHEN** `normalize_editable_document` receives a valid legacy V1 drawing document
- **THEN** it returns a valid editable V2 document with `base = []`, `tail = original V1 strokes in original order`, and the surface's canonical dimensions and background preserved

#### Scenario: Rust rejects malformed or out-of-policy documents
- **WHEN** `validate_document` or any Rust-owned document operation receives malformed JSON, an unsupported version or kind, empty strokes, out-of-bounds points, invalid brush sizes, or aggregate limit violations
- **THEN** the operation rejects with a stable Rust-owned validation or size-limits error instead of accepting a TypeScript-side best-effort parse

### Requirement: Persisted payload decode supports distinct editable and canonical read modes
The system SHALL expose separate Rust-owned decode operations for editor hydration and canonical read paths so the application never has to guess which normalization mode applies to a stored payload.

#### Scenario: Editable decode returns Rust-owned editable V2 JSON
- **WHEN** `decode_editable_document` receives valid compressed persisted bytes
- **THEN** it returns editable V2 JSON using the Rust-owned editable normalization rule for editor hydration and local draft continuation

#### Scenario: Canonical decode returns canonical V2 JSON
- **WHEN** `decode_canonical_document` receives valid compressed persisted bytes
- **THEN** it returns canonical V2 JSON using the Rust-owned canonical normalization rule for non-editable read paths and derived rendering inputs

### Requirement: Publish preparation preserves the exact protected-tail contract
The system SHALL implement publish preparation in Rust with exact normalization, complete-stroke protected-tail retention, prefix-only exact compaction, and the approved safe raster-guard preset vocabulary.

#### Scenario: Protected tail remains intact during publish preparation
- **WHEN** `prepare_publish_document` processes a valid editable document whose trailing complete strokes reach the configured tail-point threshold
- **THEN** the returned V2 document preserves those trailing complete strokes unchanged in `tail` and compacts only the prefix before that boundary

#### Scenario: Publish preparation never substitutes the approximate research pipeline
- **WHEN** `prepare_publish_document` prepares a publish-ready drawing document
- **THEN** it uses exact prefix-only compaction rather than the approximate prod-like pipeline

#### Scenario: Unsupported raster-guard overrides are rejected
- **WHEN** `prepare_publish_document` receives a raster-guard preset override outside `canonical`, `conservative`, or `veryConservative`
- **THEN** the operation rejects instead of silently selecting a different preset

### Requirement: Storage preparation preserves the current persistence contract without replaying client compaction
The system SHALL prepare persisted stroke-json payloads in Rust by returning canonical V2 JSON bytes plus gzip-compressed storage bytes while preserving the existing storage contract and avoiding backend replay of client publish-compaction policy.

#### Scenario: Legacy V1 documents remain acceptable for storage preparation
- **WHEN** `prepare_storage_document` receives valid V1 JSON for a persistence path
- **THEN** it returns canonical V2 JSON bytes and compressed storage bytes representing the approved legacy V1 compatibility normalization

#### Scenario: Already-prepared V2 documents are canonicalized without structural replay
- **WHEN** `prepare_storage_document` receives a valid already-prepared V2 document
- **THEN** it canonicalizes and compresses that document without re-selecting a protected tail, re-running client compaction heuristics, or otherwise changing the product structure beyond Rust-owned canonical serialization

### Requirement: Exact oracle and prod-like research pipeline are separate Rust-owned operations
The system SHALL expose exact raster-oracle evaluation and approximate prod-like research execution as distinct Rust-owned operations, and the default prod-like path SHALL keep the approved fixed settings used by the current repo direction.

#### Scenario: Exact raster oracle returns document output plus oracle metrics
- **WHEN** `run_exact_raster_oracle` processes a valid drawing document
- **THEN** it returns the Rust-owned oracle result document and structured oracle metrics from the same runtime that owns candidate acceptance behavior

#### Scenario: Prod-like pipeline uses approved default settings
- **WHEN** `run_prod_like_pipeline` runs with default configuration
- **THEN** it uses 20 iterations, phase 1 tolerance `0.5`, phase 1 high-quality mode `true`, and the Rust geometry adapter backed by Clipper 2

#### Scenario: Default phase 1 behavior preserves approved parity targets
- **WHEN** the default prod-like pipeline is validated on representative parity fixtures
- **THEN** its phase 1 simplification behavior matches the approved `simplify-js` reference behavior for tolerance `0.5` and high-quality mode `true`