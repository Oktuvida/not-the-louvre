## Context

The repo already moved product flows toward `DrawingDocumentV2`, exact protected-tail publish preparation, and gzip-plus-base64 persisted drawing payloads, but the correctness-sensitive logic still lives in TypeScript modules such as `document.ts`, `storage.ts`, `publish.ts`, `compaction.ts`, `phase2.ts`, and `prod-like-pipeline.ts`. That leaves browser and server behavior coupled to separate JavaScript implementations at the same time that large drawings are becoming expensive enough to matter operationally.

There is partial Rust/WASM scaffolding in the repo today: `crates/stroke-json-core`, `crates/stroke-json-wasm`, `packages/stroke-json-runtime`, and generated browser/server WASM artifacts already exist, but the workspace does not yet have a committed Cargo workspace, pinned Rust toolchain, runtime package implementation, or root build/test/deploy wiring that makes those artifacts reproducible and authoritative. The current root workspace only includes `apps/*`, `apps/web/scripts/deploy/vps-admin.ts` validates Node/Bun/Caddy but not Rust tooling, and the production build intentionally excludes `/demo`, which means the existing demo route is not a sufficient deploy gate for runtime adoption.

This change therefore needs to do more than port algorithms. It must define one authoritative Rust-owned contract for validation, compaction, and persistence preparation, wrap it behind a narrow TypeScript API for browser and server consumers, preserve the existing storage format and publish semantics, and make the host build/deploy path reliably regenerate and validate the runtime artifacts.

## Goals / Non-Goals

**Goals:**
- Make Rust the only authority for stroke-json document validity, normalization, canonical serialization, exact publish preparation, storage preparation, exact oracle execution, and prod-like research operations.
- Keep heavy browser work off the main thread by routing browser calls through a dedicated worker and coarse-grained operations.
- Preserve the current persisted storage contract: canonical V2 JSON, gzip-compressed, base64-encoded at string boundaries.
- Preserve the current exact protected-tail publish policy and approved V1/V2 compatibility semantics while moving execution into Rust.
- Make Rust/WASM outputs reproducible in local, CI, and VPS flows with explicit workspace scripts, pinned toolchain inputs, and runtime smoke validation.

**Non-Goals:**
- Introducing a native Rust-only server path in the first cut.
- Keeping silent TypeScript fallbacks for validation, compaction, or canonicalization once a boundary has moved to Rust.
- Changing the persisted payload shape, storage column contract, or publish raster-guard preset vocabulary.
- Moving preview rendering, canvas interaction, or media presentation logic into Rust.
- Requiring true WASM request cancellation or streaming partial results in the first iteration.

## Decisions

### 1. Treat the existing Rust/WASM directories as the foundation, but formalize them into a reproducible workspace

The repo already contains `crates/stroke-json-core`, `crates/stroke-json-wasm`, `packages/stroke-json-runtime`, and generated WASM outputs. This change will not create a parallel implementation. Instead, it will add the missing Cargo workspace, lockfiles, toolchain pinning, package manifests, and root scripts needed to turn that scaffold into the canonical build path.

Alternative considered: leave the current directories as ad hoc build artifacts driven from app-local scripts. Rejected because it preserves drift risk, makes host reproducibility implicit, and keeps generated artifacts detached from an auditable workspace contract.

### 2. Rust exports only coarse-grained document operations, not step-by-step geometry primitives

The authoritative boundary will be operation-oriented: `validate_document`, `normalize_editable_document`, `serialize_editable_document`, `decode_editable_document`, `decode_canonical_document`, `prepare_publish_document`, `prepare_storage_document`, `encode_validated_document`, `run_exact_raster_oracle`, and `run_prod_like_pipeline`. This maps directly onto the current TypeScript authority boundaries in `document.ts`, `drafts.ts`, `publish.ts`, and `storage.ts`, while minimizing JS/WASM crossings on large drawings.

Alternative considered: expose phase 1, phase 2, and raster helpers as fine-grained exports and keep orchestration in TypeScript. Rejected because it would preserve duplicated authority in JavaScript, increase boundary cost, and make browser/server semantics easier to drift apart.

### 3. The browser talks to Rust only through a dedicated worker-backed runtime package

The browser integration will use a worker that owns WASM initialization and request execution for the entire session. UI code will continue to hold mutable in-memory drawing state for pointer handling and preview rendering, but all correctness-sensitive transitions will route through the runtime package: draft migration, draft serialization, persisted decode, publish preparation, and research/demo execution. The worker protocol stays minimal (`id`, `type`, `payload`) and stale responses are discarded via revision tracking rather than true execution cancellation.

Alternative considered: initialize WASM directly on the main thread. Rejected because the spec explicitly requires heavy compaction/oracle work to stay off the main thread and because large-payload initialization and execution would compete with interaction/rendering.

### 4. The server uses the same ESM-target WASM output through a lazy bundled entrypoint

The first-cut server model will keep using an ESM-compatible bundler target and lazy memoized initialization rather than introducing a separate native Rust path. `packages/stroke-json-runtime` will expose dedicated browser and server entrypoints over the same generated bundler artifact. `apps/web/vite.config.ts` and build scripts will keep the runtime inside the SSR bundle path so the emitted `.wasm` asset is owned by Vite and validated by a bundled server-runtime smoke test after build.

Alternative considered: externalize the runtime package and resolve `.wasm` files through relative filesystem paths at runtime, or introduce a native server crate immediately. Rejected because both increase deployment fragility relative to the current adapter-node ESM build and add packaging complexity before the shared runtime contract is stable.

### 5. Rust becomes the sole authority for publish and persistence semantics, but the storage contract stays unchanged

`prepare_publish_document` will preserve the existing exact protected-tail policy: exact normalization, protected-tail selection by trailing complete strokes up to at least 1000 points, exact prefix-only compaction, and safe raster-guard preset enforcement. `prepare_storage_document` will accept submitted V1 or V2 JSON, return canonical V2 JSON plus gzip bytes and metadata, and explicitly avoid replaying client publish compaction on the server hot path. Base64 remains a TypeScript-wrapper concern at text/database boundaries only.

Alternative considered: let the backend recompute publish preparation or let the runtime wrapper decide normalization modes dynamically. Rejected because both blur authority boundaries and risk mutating already-prepared V2 documents in ways the current product contract does not allow.

### 6. Migration proceeds in slices, with duplicate TypeScript logic removed only after parity gates hold

The migration will follow the source design's slice order: core skeleton, exact oracle, prod-like pipeline, browser integration, product/backend adoption, then duplicate-code removal. Until the final slice, existing TypeScript modules remain available as migration references and fallback implementation detail for unaffected paths, but not as silent runtime fallbacks once a boundary switches to Rust. Every slice is gated by fixtures, goldens, contract tests, or smoke tests that prove parity or required behavior.

Alternative considered: big-bang replacement of all stroke-json paths in one cut. Rejected because it would make it much harder to isolate regressions in document normalization, publish policy, SSR loading, or deploy wiring.

## Risks / Trade-offs

- Geometry-engine parity risk with `clipper2` and `simplify-polyline` → Hide geometry behind an internal adapter and require fixture/golden parity before each cutover is accepted.
- Browser worker async state can race draft hydration or autosave writes → Use latest-write-wins revisioning, debounce autosave, and require tests proving stale worker responses never overwrite newer drafts.
- SSR `.wasm` packaging can fail silently in adapter-node builds → Keep the runtime inside the SSR bundle path and add a post-build smoke test that imports and initializes the bundled server entrypoint, not just a file-existence check.
- Existing generated artifacts can drift from source because the repo lacks a formal build contract → Add pinned toolchain inputs, a single `stroke-json:wasm:build` entrypoint, deterministic clean behavior, and top-level gates that always regenerate before validating.
- Migration overlaps product publish/save paths that already persist drawing documents → Preserve the current payload contract and exact publish policy so rollback remains a build rollback rather than a data migration.

## Migration Plan

1. Establish the Cargo workspace, Rust toolchain pinning, runtime package manifest/layout, and root scripts so Rust/WASM artifacts are generated reproducibly.
2. Port Rust-owned document modeling, validation, canonical serialization, compression, exact normalization, raster guard resolution, and exact oracle behavior behind fixture-backed goldens.
3. Port the prod-like pipeline behind explicit defaults and parity tests for the approved `simplify-js` settings and current phase-2 semantics.
4. Implement the runtime package browser worker and server entrypoints, wire `/demo/stroke-json` to Rust-owned operations, and add browser/server initialization smoke tests.
5. Move product draft, publish, storage, and backend validation/encoding boundaries from TypeScript modules to runtime package calls while preserving the exact publish and persistence contracts.
6. Remove duplicated TypeScript correctness logic from `document.ts`, `storage.ts`, `publish.ts`, `compaction.ts`, `phase2.ts`, and `prod-like-pipeline.ts`, leaving only adapters, rendering helpers, and presentation glue.

Rollback strategy:
- Keep the persisted payload contract unchanged throughout the rollout so a failed deployment can fall back to the previous application build without data backfill or payload migration.
- Delay duplicate-code removal until after browser, server, and deploy smoke gates are green, so earlier slices can be reverted by redirecting integration call sites back to the existing TypeScript modules if needed.

## Open Questions

- Should this change explicitly supersede the open `stroke-json-rust-prod-like-pipeline` change, or should that earlier change be kept as a narrower prerequisite and archived separately once scope is absorbed?
- Which exact `wasm-pack` version should be pinned in repo-managed tooling so local, CI, and VPS validation all agree on one reproducible installer target?
- Should product adoption after the demo/browser slice move avatar and artwork boundaries together, or is artwork-first acceptable if the shared runtime contract is already proven by fixtures and server smoke tests?