## 1. Workspace and toolchain foundation

- [x] 1.1 Add the missing Cargo workspace files, Rust package manifests, `rust-toolchain.toml`, and lockfile needed to turn the existing Rust/WASM scaffolding into a reproducible workspace.
- [x] 1.2 Expand the root Bun workspace and scripts so Rust formatting, linting, checking, testing, and `stroke-json:wasm:build` participate in top-level `format`, `lint`, `check`, `test`, and `build` flows.
- [x] 1.3 Add repo-managed validation for the required `wasm32-unknown-unknown` target, pinned `wasm-pack` version, and deterministic cleanup/regeneration of `packages/stroke-json-runtime/generated/wasm/`.
- [x] 1.4 Add failing build/deploy smoke tests that expect authoritative WASM generation and bundled server-runtime initialization before wiring the implementation.

## 2. Rust document core and persistence contract

- [x] 2.1 Add failing Rust fixture tests for V1/V2 parsing, semantic validation, editable normalization, canonical decode, and storage compatibility expectations.
- [x] 2.2 Implement Rust document models, semantic validation, canonical serialization, and explicit editable versus canonical normalization operations.
- [x] 2.3 Implement Rust compression, decompression, `prepare_storage_document`, and `encode_validated_document`, including byte-limit enforcement and persistence metadata.
- [x] 2.4 Add golden and compatibility fixtures that prove canonical JSON output and persisted gzip/base64 contract compatibility for legacy V1, editable V2, and already-prepared V2 inputs.

## 3. Exact publish and research processing

- [x] 3.1 Add failing Rust tests for exact normalization, protected-tail publish preparation, raster-guard preset enforcement, and server non-replay behavior for already-prepared V2 documents.
- [x] 3.2 Port the exact raster helper, raster-guard resolution, and oracle acceptance logic into Rust and expose `run_exact_raster_oracle`.
- [x] 3.3 Implement `prepare_publish_document` in Rust so publish keeps exact prefix-only compaction and the approved safe preset vocabulary.
- [x] 3.4 Add failing parity fixtures for the approved default prod-like phase 1 and phase 2 behavior using the current TypeScript pipeline as the migration reference.
- [x] 3.5 Port the prod-like pipeline into Rust with `simplify-polyline`, a Clipper 2 adapter, exported default constants, and parity-backed metrics reporting.

## 4. Runtime package and browser worker integration

- [x] 4.1 Add failing TypeScript contract tests for runtime wrapper APIs, worker request/response routing, stale-response handling, and runtime initialization failures.
- [x] 4.2 Implement `packages/stroke-json-runtime` browser and server entrypoints with typed APIs and internal UTF-8, gzip, and base64 translation over the generated WASM exports.
- [x] 4.3 Implement the browser worker protocol, single-module lifecycle, revision-safe draft hydration, and debounced autosave integration.
- [x] 4.4 Wire `/demo/stroke-json` and other stroke-json research surfaces to the Rust-backed worker path instead of the current TypeScript algorithm modules.

## 5. Product and server adoption

- [x] 5.1 Add failing server and route tests for lazy server-runtime loading, stable error translation, publish preparation, and storage encoding through Rust-owned operations.
- [x] 5.2 Wire backend persistence and media-generation paths to use Rust validation and `prepare_storage_document`, preserving the current canonical V2 plus derived-media contract.
- [x] 5.3 Wire client publish and save flows to use `prepare_publish_document` and submit Rust-produced payloads without backend compaction-policy replay.
- [x] 5.4 Route artwork and avatar draft migration, persisted decode, and editor hydration boundaries through the runtime package.

## 6. Build, deploy, and cleanup

- [x] 6.1 Update `apps/web` Vite and build scripts so the runtime package stays inside the SSR bundle path and emitted server `.wasm` assets are validated in the built output.
- [x] 6.2 Add the required clean full-app build and browser worker/WASM smoke gate while the initial browser consumer remains under `/demo/stroke-json`.
- [x] 6.3 Update `apps/web/scripts/deploy/vps-admin.ts` and related deployment automation to validate Rust prerequisites, run the authoritative WASM build flow, and smoke-test the bundled server runtime before restart.
- [x] 6.4 Remove duplicated TypeScript correctness logic from the stroke-json document, storage, publish, compaction, phase 2, and prod-like pipeline modules once runtime-backed paths and parity tests are green.
- [x] 6.5 Run the root `format`, `lint`, `check`, and `test` gates with the new Rust/runtime coverage and fix any regressions introduced by the migration.