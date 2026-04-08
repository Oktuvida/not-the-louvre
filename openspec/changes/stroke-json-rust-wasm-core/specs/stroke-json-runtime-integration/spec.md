## ADDED Requirements

### Requirement: The runtime package is the sole TypeScript boundary owner for Rust/WASM operations
The system SHALL expose stroke-json Rust/WASM behavior to application code only through `packages/stroke-json-runtime`, and that package SHALL keep low-level UTF-8, gzip, base64, and generated-WASM translations internal.

#### Scenario: Application code uses typed runtime methods instead of generated WASM glue
- **WHEN** browser or server application code needs publish, decode, validation, or storage behavior
- **THEN** it calls typed runtime-package methods and does not import generated WASM bindings directly

#### Scenario: Persisted string boundaries stay wrapper-owned
- **WHEN** a caller provides or consumes a persisted base64 drawing-document payload
- **THEN** the runtime package performs the base64 and binary conversions internally before or after calling Rust-owned operations

### Requirement: Browser correctness-sensitive operations execute in a dedicated worker
The system SHALL run browser correctness-sensitive stroke-json operations through a dedicated worker that owns WASM initialization and request execution for the session.

#### Scenario: Worker responses correlate to the originating request
- **WHEN** the browser runtime posts a worker request with `id`, `type`, and `payload`
- **THEN** the worker responds with the same `id` and either a completed `result` or a structured `error`

#### Scenario: Heavy browser processing stays off the main thread
- **WHEN** the application performs draft migration, publish preparation, exact oracle execution, or prod-like demo work in the browser
- **THEN** the operation runs inside the stroke-json worker rather than on the main thread

### Requirement: Draft hydration and autosave are revision-safe
The system SHALL coordinate worker-backed draft hydration and autosave so older worker responses cannot overwrite newer local draft state.

#### Scenario: Stale hydration response is discarded
- **WHEN** multiple draft-hydration requests overlap and an older response resolves after a newer revision has already won
- **THEN** the older response is discarded and does not replace the newer in-memory or persisted draft state

#### Scenario: Autosave persists the newest completed serialized draft
- **WHEN** rapid drawing triggers debounced autosave while earlier worker requests are still in flight
- **THEN** local storage is updated only with the newest completed Rust-serialized draft payload

### Requirement: Server runtime loading is lazy, memoized, and bundle-owned
The system SHALL load the server stroke-json runtime through a dedicated bundled server entrypoint that lazily initializes the generated WASM module and memoizes that initialized instance for later server calls.

#### Scenario: First server call initializes the runtime once
- **WHEN** the first stroke-json server operation is requested after process start
- **THEN** the server runtime initializes the bundled WASM module lazily and returns that initialized instance for reuse by subsequent operations

#### Scenario: Built server runtime loads the emitted WASM asset through the bundled entrypoint
- **WHEN** the adapter-node server build is produced
- **THEN** the built server runtime loads the emitted `.wasm` asset through its bundled server entrypoint rather than through ad hoc relative filesystem guesses

### Requirement: Runtime failures translate into stable browser and server contracts without TypeScript fallback
The system SHALL translate Rust/WASM failure categories into stable browser-worker and server-facing error contracts, and SHALL not silently fall back to older TypeScript correctness implementations when runtime initialization or execution fails.

#### Scenario: Invalid document failures translate consistently on the server
- **WHEN** a server-side runtime call fails with `invalid_document`
- **THEN** the server returns HTTP `400` with app code `INVALID_DRAWING_DOCUMENT`

#### Scenario: Oversized document failures translate consistently on the server
- **WHEN** a server-side runtime call fails with `document_limits_exceeded`
- **THEN** the server returns HTTP `413` with app code `DRAWING_DOCUMENT_TOO_LARGE`

#### Scenario: Runtime initialization failure surfaces clearly without fallback
- **WHEN** worker or server runtime initialization fails with `init_failed` or `internal_error`
- **THEN** the dependent operation fails with a stable runtime error contract and does not retry the same operation through a TypeScript-side correctness implementation