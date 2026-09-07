## Why

The repo already committed to `DrawingDocumentV2`, exact raster-validated compaction, and a shared stroke-json source of truth, but the product still splits document authority across browser-side TypeScript, backend glue, and separate compaction/oracle implementations. That split now creates meaningful latency on large drawings, duplicated correctness rules, and drift risk at the exact point where publish, persistence, and draft-recovery behavior are becoming product-critical.

This change moves heavy stroke-json processing behind a Rust-first shared runtime so browser and server consumers use the same authoritative document model, compaction semantics, and persistence preparation path. It also makes the deploy story explicit by treating Rust/WASM build artifacts as first-class workspace outputs rather than optional local tooling.

## What Changes

- Establish a real Cargo workspace around the existing `stroke-json-core` and `stroke-json-wasm` scaffolding and make those crates the only authority for stroke-json document modeling, validation, normalization, canonical serialization, compaction, exact raster-oracle behavior, and prod-like research operations.
- Turn the existing `packages/stroke-json-runtime` scaffolding into the only TypeScript-facing boundary for browser workers and server consumers, including JSON/UTF-8/gzip/base64 translations, module initialization, and stable error translation.
- Route correctness-sensitive drawing boundaries through coarse-grained Rust/WASM operations: draft migration and serialization, persisted-payload decode, publish preparation, storage preparation, exact oracle execution, and prod-like lab runs.
- Preserve the current exact protected-tail publish contract and legacy V1/V2 compatibility semantics while removing silent TypeScript fallbacks for the same validation or compaction rules.
- Make Rust/WASM builds reproducible in local, CI, and VPS flows with pinned toolchain inputs, generated runtime artifacts under the workspace, SSR-compatible bundling, and deploy-time runtime smoke validation.

## Capabilities

### New Capabilities
- `stroke-json-processing`: Rust-owned stroke-json document lifecycle covering V1/V2 validation, normalization, canonical serialization, exact publish preparation, storage preparation, exact raster oracle, and prod-like pipeline behavior.
- `stroke-json-runtime-integration`: Shared browser/server runtime integration covering worker-backed browser execution, memoized server loading, stable request/response contracts, stale-response handling, and translated runtime errors without TypeScript correctness fallbacks.
- `stroke-json-runtime-tooling`: Reproducible Rust/WASM workspace tooling covering pinned toolchains, generated artifact management, SSR packaging, top-level quality gates, and VPS install/deploy validation.

### Modified Capabilities

None.

## Impact

- Affected code: `crates/stroke-json-core`, `crates/stroke-json-wasm`, `packages/stroke-json-runtime`, browser worker/runtime adapters, draw draft helpers, stroke-json storage/publish helpers, backend persistence/media integration, workspace package manifests, and deploy/build scripts.
- Affected systems: browser drawing flows, demo stroke-json lab, backend drawing persistence, SSR runtime loading, Rust/WASM build reproducibility, and VPS install/deploy validation.
- Affected dependencies: Rust toolchain management, `wasm-pack`, Rust geometry/simplification crates, generated WASM assets, and fixture/golden test coverage spanning Rust and TypeScript contract layers.