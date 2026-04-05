# Stroke JSON Rust WASM Core

**Date:** 2026-04-04
**Status:** Proposed

## Context

The stroke-json work already established two important product directions in the
repo:

- `DrawingDocumentV2` is the long-term editable and persisted drawing format.
- the exact raster-validated compactor remains the correctness oracle, while the
  selected approximate prod-like path is phase 1 `simplify-js` followed by
  phase 2 Clipper 2.

However, the heavy stroke-json processing still lives in TypeScript.

- phase 1 simplification runs in browser-side JavaScript
- phase 2 geometry work runs in browser-side TypeScript with `clipper2-ts`
- the exact raster oracle also lives in TypeScript
- browser and server code still carry document parsing, validation, and
  persistence logic outside a single shared runtime

For large artworks, the current client-side processing is already slow enough to
matter operationally. The user now wants to exploit the monorepo structure to
introduce a small Rust-based shared library that becomes the single source of
truth for all heavy stroke-json work.

The required product direction is explicit:

- the browser should send an uncompressed editable document into a worker-backed
  WASM runtime
- Rust should perform the heavy processing and return the compacted result
- Rust should own document correctness, not just geometry helpers
- the exact raster oracle should be included from the first cut
- TypeScript should stop duplicating stroke-json algorithms and semantic
  validation
- the production deploy/install workflow should build the Rust/WASM artifacts on
  the host, assuming Rust tooling is available there

This design builds on the earlier stroke-json V2 work rather than replacing it.
It changes the execution boundary and source-of-truth runtime, not the product's
chosen compaction direction.

## Decision

Adopt a Rust-first stroke-json core inside the monorepo and expose it to both
browser and server consumers through a narrow WASM boundary.

- Rust becomes the only source of truth for stroke-json document modeling,
  validation, canonical serialization, compaction, geometry processing, and the
  exact raster oracle.
- The browser uses that Rust core through a dedicated worker so no heavy
  processing runs on the main thread.
- The backend uses the same Rust core through the same WASM-facing package in
  the first cut, prioritizing a simple build over a separate native-server path.
- TypeScript remains responsible for UI, transport wiring, preview rendering,
  and integration glue only.
- The worker and server both call coarse-grained Rust operations rather than
  composing phase 1, phase 2, or oracle steps from JavaScript.
- Phase 1 uses `simplify-polyline`.
- Phase 2 uses `clipper2` behind an internal geometry adapter.
- `Clipper2-WASM` is not used.

## Goals

- Make Rust the single source of truth for stroke-json correctness and heavy
  processing.
- Keep the browser main thread free of compaction, oracle, and geometry work.
- Minimize JS/WASM boundary crossings by exposing only coarse-grained
  operations.
- Reuse the same core for browser and backend behavior.
- Preserve the exact raster oracle from the first cut rather than migrating it
  later.
- Keep the build and deployment flow operationally simple enough for a single
  VPS host build.
- Preserve compatibility with existing V1/V2 document semantics and current V2
  product direction.

## Non-Goals

- Keeping TypeScript fallbacks for the same document validation or compaction
  logic after the Rust path is adopted.
- Embedding `Clipper2-WASM` inside Rust or building a WASM-inside-WASM stack.
- Introducing a separate native Rust backend runtime in the first cut.
- Making the first cut depend on request cancellation or streaming partial
  results from WASM.
- Auto-installing Rust toolchains from the production install script.
- Redesigning the current raster-guard presets or changing the chosen prod-like
  pipeline semantics.

## Architecture

## Runtime Topology

The new runtime shape is:

```text
browser UI
    -> stroke-json worker
    -> stroke-json-wasm
    -> stroke-json-core

server integration
    -> stroke-json-wasm
    -> stroke-json-core
```

The main thread never calls the Rust core directly.

- UI code posts requests to a worker.
- The worker owns module initialization and request execution.
- The worker returns only completed operation results or structured errors.

The backend uses the same Rust-facing package but does not need a worker.

## Package Layout

The monorepo gains a small Rust workspace plus one thin TypeScript runtime
package.

```text
crates/
  stroke-json-core/
  stroke-json-wasm/

packages/
  stroke-json-runtime/
```

Responsibilities:

- `stroke-json-core`
  - document types
  - semantic validation
  - canonical serialization
  - compression/decompression
  - exact normalization
  - phase 1 simplification
  - phase 2 geometry compaction
  - raster guard
  - exact raster oracle
  - prod-like pipeline orchestration
- `stroke-json-wasm`
  - WASM exports
  - boundary-safe request/response types
  - JS-facing error translation
- `packages/stroke-json-runtime`
  - worker lifecycle
  - WASM loading for browser and server
  - stable TypeScript-facing runtime API

The Bun workspace should expand to include `packages/*` so the runtime wrapper
can participate in the same workspace tooling as `apps/web`.

## Responsibility Boundaries

Rust owns all product-important stroke-json rules.

TypeScript does not decide:

- whether a document is semantically valid
- how V1 and V2 are normalized for a Rust-owned operation
- how compaction works
- how the exact raster oracle works
- how a persist-ready payload is produced

TypeScript still owns:

- UI state and user interaction
- canvas preview rendering
- worker request orchestration
- request cancellation at the UI level by discarding stale results
- transport to server endpoints

This intentionally removes algorithmic authority from the web app layer.

## Rendering Boundaries

Rust owns document correctness, compaction, and oracle semantics, but rendering
surfaces remain integration responsibilities outside the Rust core.

TypeScript continues to own:

- browser canvas preview rendering
- browser diff and preview presentation wiring
- server SVG generation and media rendering integrations that consume validated
  stroke-json documents

These rendering layers must consume Rust-validated or Rust-produced documents.
They do not become second authorities for document correctness.

For backend media generation, the authoritative render input must be the same
canonical V2 snapshot returned by `prepare_storage_document`. Persisted drawing
JSON and derived server media must be produced from that same Rust-owned
snapshot, not from separate pre-validation request data.

## Document Contract

## Rust-Owned Schema

The authoritative runtime model for drawing documents moves into Rust.

Rust defines:

- `DrawingDocumentV1`
- `DrawingDocumentV2`
- `DrawingStroke`
- `DrawingPoint`
- document limits
- kind-specific dimension rules

These types serialize and deserialize with `serde`.

The Rust core also owns semantic checks equivalent to or stronger than the
current TypeScript document layer:

- allowed `kind` values
- allowed document versions
- fixed dimensions and backgrounds per kind
- point bounds within the canvas
- non-empty strokes
- valid brush sizes
- aggregate stroke and point limits
- compressed and decompressed byte limits where relevant

TypeScript may still mirror these shapes as static types for ergonomics, but
runtime validity comes only from Rust.

## Normalization Modes

The Rust core should expose explicit operations rather than one ambiguous global
normalization rule.

At minimum, the core must preserve the current two important semantics already
present in the repo:

- editable V2 normalization for product editing boundaries that treat incoming
  V1 history as recent editable tail state
- the same approved legacy V1 compatibility rule on write when a persistence
  path accepts V1 input: `base = []`, `tail = original V1 strokes in original
  order`

These semantics must be named explicitly inside Rust-owned operations so the app
never guesses which conversion is happening.

## Canonical Serialization

Rust owns canonical JSON field ordering and canonical compressed payload
generation.

The output of a Rust persistence-oriented operation must be sufficient for the
backend to know:

- the document is valid
- the serialized JSON is canonical
- the compressed payload was derived from that canonical document

This removes the need for duplicated JSON serialization policy in TypeScript.

## Persisted Storage Format

The persisted storage contract remains the same unless a separate superseding
design changes it.

Persisted drawing documents remain:

- canonical V2 JSON
- gzip-compressed
- base64-encoded for text storage and transport boundaries that currently use
  string payloads

Boundary ownership:

- Rust returns raw canonical JSON bytes and raw gzip bytes
- the TypeScript runtime or server adapter is solely responsible for base64
  text encoding and decoding at database and string-transport boundaries
- `decode_*` operations consume raw gzip bytes after that outer base64 layer has
  been removed by the wrapper

This preserves the repo's current text-column storage contract while still
keeping Rust responsible for the canonical binary and JSON representations.

## WASM Boundary And Operation Model

## Coarse-Grained Operations

The JavaScript side should not call phase 1, phase 2, or raster checks as
separate exported primitives. The Rust/WASM boundary should expose complete
operations.

Initial operations:

- `validate_document`
- `normalize_editable_document`
- `serialize_editable_document`
- `decode_editable_document`
- `decode_canonical_document`
- `prepare_publish_document`
- `prepare_storage_document`
- `encode_validated_document`
- `run_exact_raster_oracle`
- `run_prod_like_pipeline`

The Rust core is shared across browser and backend consumers, but they do not
all call the same top-level operation.

### Consumer-Specific Operation Boundaries

The client publish/save path should center on `prepare_publish_document`.

That operation receives an uncompressed editable drawing document and applies
the full client-owned publish preparation policy, including Rust-owned
normalization, protected-tail handling, and exact compaction.

Its result includes:

- validated publish-ready document JSON
- structured metrics and warnings

The backend must not reapply client publish compaction policy.

Instead, backend persistence paths should use `validate_document` plus
`prepare_storage_document` as the hot-path operation over the submitted client
document.

`prepare_storage_document` accepts raw JSON UTF-8 bytes for submitted V1 or V2
documents and returns, in one call:

- canonical V2 JSON bytes
- compressed storage bytes
- persistence metadata

Its guarantees are:

- legacy V1 inputs remain accepted and normalize using the approved
  editable-V2 compatibility rule on write: `base = []`, `tail = original V1
  strokes in original order`
- submitted V2 inputs remain structurally intact apart from Rust-owned
  validation and canonical serialization requirements
- no client publish compaction policy is re-applied on the server hot path

That server-side operation must not:

- re-select a protected tail
- re-run client publish compaction heuristics
- change an already-prepared V2 document's product structure beyond canonical
  serialization guarantees

`validate_document` remains useful as a separate preflight, debugging, and test
operation, while `encode_validated_document` may still exist as an internal or
auxiliary helper. The coarse-grained backend persistence contract should center
on `prepare_storage_document`.

Read boundaries must also stay explicit:

- local draft migration from raw JSON uses `normalize_editable_document`
- local draft save serialization uses `serialize_editable_document`
- editor hydration from persisted payloads uses `decode_editable_document`
- persistence or non-editable canonical read paths use
  `decode_canonical_document`

Draft key naming and version selection remain TypeScript runtime concerns, but
the actual draft document migration and rewrite content are Rust-owned.

This preserves the repo's existing direction that client publish preparation
and server validation/persistence are separate responsibilities even though both
now run on the same Rust core.

### Publish Policy Preservation

`prepare_publish_document` must preserve the existing approved publish contract.

That means publish remains:

- exact
- protected-tail preserving
- prefix-only in what it makes eligible for compaction
- separate from the approximate prod-like research pipeline

The required publish rules are:

- exact-normalize the full ordered stroke sequence before publish decisions
- form `orderedStrokes = [...base, ...tail]`
- select the protected tail by traversing `orderedStrokes` from the end and
  counting complete strokes only until the accumulated point count is at least
  1000, or all strokes are included
- preserve the protected tail as complete strokes only, with no stroke splitting
  inside the protected tail
- compact only the prefix before that protected tail
- use exact prefix-only compaction rather than the approximate prod-like
  pipeline
- default to the same safe raster-guard preset already approved for product
  publish, currently `veryConservative`
- allow only the existing safe preset vocabulary for overrides:
  `canonical`, `conservative`, and `veryConservative`

`run_prod_like_pipeline` remains a demo and research operation only. It is not a
persistence path and must not be used by `prepare_publish_document` unless a
future design explicitly supersedes the current exact protected-tail policy.

## Request And Response Shape

The boundary should prefer bytes or strings over deep JS object graphs.

Recommended input:

- `Uint8Array` UTF-8 JSON payloads for document-oriented operations
- raw compressed bytes for persisted-payload decode operations

Recommended output:

- canonical JSON bytes or strings
- compressed bytes
- compact result metadata as a small structured object or JSON blob
- stable error codes

This keeps the WASM boundary narrow and avoids paying avoidable object
materialization costs on very large drawings.

### Operation Input And Output Contracts

Each operation must declare its payload format explicitly.

- `validate_document`
  - input: raw JSON UTF-8 bytes
  - output: validation result plus normalized metadata only
- `normalize_editable_document`
  - input: raw JSON UTF-8 bytes, including legacy V1 draft JSON
  - output: editable V2 JSON bytes suitable for draft migration or editor load
- `serialize_editable_document`
  - input: raw editable document JSON UTF-8 bytes
  - output: canonical editable V2 JSON bytes suitable for local draft rewrite
- `decode_editable_document`
  - input: compressed persisted bytes
  - output: editable V2 JSON bytes using the Rust-owned editable normalization
    rule
- `decode_canonical_document`
  - input: compressed persisted bytes
  - output: canonical V2 JSON bytes using the Rust-owned canonical normalization
    rule
- `prepare_publish_document`
  - input: raw editable document JSON UTF-8 bytes
  - output: publish-ready exact V2 document JSON bytes plus metrics and warnings
- `prepare_storage_document`
  - input: raw JSON UTF-8 bytes for submitted V1 or V2 documents
  - output: canonical V2 JSON bytes plus compressed storage bytes and
    persistence metadata, without client publish compaction replay
- `encode_validated_document`
  - input: raw JSON UTF-8 bytes for an already-prepared V2 document
  - output: canonical JSON bytes plus compressed storage bytes
- `run_exact_raster_oracle`
  - input: raw JSON UTF-8 bytes
  - output: oracle result document JSON plus oracle metrics
- `run_prod_like_pipeline`
  - input: raw JSON UTF-8 bytes
  - output: final pipeline document JSON plus iteration metrics

This keeps draft save/load, hydration, publish preparation, and storage encoding
as explicit contracts rather than one overloaded decode/encode surface.

## TypeScript Runtime Package API

`packages/stroke-json-runtime` is the only TypeScript boundary owner for the
Rust/WASM runtime.

Application code should not pass raw UTF-8 bytes, raw gzip bytes, or base64
text directly to low-level WASM exports. The runtime package owns those
translations.

Its public browser and server methods should accept and return the same kinds of
values that current repo call sites already work with:

- typed JS drawing-document objects for in-memory editing and publish flows
- persisted payload strings for storage and hydration boundaries that already
  use base64 text
- small structured result objects for metrics, warnings, and translated errors

Low-level JSON, gzip, base64, and UTF-8 conversions stay internal to the runtime
package.

### Editable Authority Rule

TypeScript may still hold mutable in-memory editor state as ordinary JS objects
for pointer handling and canvas rendering.

However, the following boundaries must route through Rust-owned operations:

- local draft serialization and migration
- persisted payload decode for editor hydration
- publish preparation
- backend validation before persistence
- canonical storage encoding

This keeps interactive editing lightweight without reintroducing a second
runtime authority for correctness-sensitive transitions.

### Draft Hydration And Autosave Protocol

Draft transport remains TypeScript-coordinated, but draft content migration and
serialization are Rust-owned.

Rules:

- localStorage read remains synchronous in TypeScript during startup
- if a draft payload exists, TypeScript sends that raw JSON to
  `normalize_editable_document`
- the normalized result is applied only if its request revision is still the
  newest hydration result for the session
- localStorage writes remain TypeScript-owned, but the serialized draft content
  must come from `serialize_editable_document`
- autosave uses latest-write-wins revisioning and a debounce window rather than
  one worker round-trip per low-level pointer mutation
- pending stale worker responses must never overwrite a newer draft revision in
  localStorage
- page reload and crash-recovery tests must prove that rapid drawing still
  preserves the newest completed serialized draft

Draft key naming and version bumps remain TypeScript concerns in the runtime
package, but the migrated draft JSON content itself is Rust-owned.

## Worker Protocol

The browser worker should use a minimal request protocol.

Request:

- `id`
- `type`
- `payload`

Response:

- `id`
- `ok`
- `result` or `error`

The worker keeps one initialized module instance for the session.

If the UI triggers overlapping requests, the first cut does not require true
execution cancellation inside WASM. The UI may instead mark older requests as
stale and discard their eventual responses.

## Geometry And Raster Internals

## Phase 1 Simplification

Phase 1 should migrate from `simplify-js` to `simplify-polyline`.

Reasons:

- it is a direct Rust port of `simplify-js`
- it exposes the same important control surface for tolerance and high-quality
  mode
- it preserves the selected prod-like phase 1 semantics with minimal conceptual
  translation

The Rust core should keep phase 1 parameters explicit and named, matching the
existing product direction.

## Rust Prod-Like Defaults

The Rust prod-like pipeline must bind to the same already-approved fixed values
used by the current repo direction.

Default constants:

- iteration count: `20`
- phase 1 tolerance: `0.5`
- phase 1 high-quality mode: `true`
- phase 2 engine: Clipper 2 via the Rust geometry adapter

`run_prod_like_pipeline` should use these values by default, with exported
named constants so the Rust runtime contract and the UI/reporting vocabulary
cannot drift.

## Phase 1 Cutover Rule

The migration from `simplify-js` to `simplify-polyline` is only acceptable if it
preserves the approved prod-like pipeline behavior for the selected fixed
settings.

Required rule:

- fixture-based parity against the current `simplify-js` path is required for
  tolerance `0.5` and high-quality mode `true` on representative stroke sets

If that parity cannot be achieved and a behavior change is still desired, that
must be treated as an explicit contract change with updated goldens and a
superseding design decision.

## Phase 2 Geometry Engine

Phase 2 should migrate from `clipper2-ts` to Rust `clipper2` in the first cut.

Reasons:

- the crate supports offsetting and boolean operations
- it exposes open-subject flows relevant to the current phase 2 approach
- it is close enough in shape to the current Clipper 2 usage to preserve the
  design without a JS runtime dependency

However, the rest of the Rust core must not depend on the crate's public API
directly. The core should define a small internal geometry-engine abstraction
and place `clipper2` behind an adapter.

This keeps three options open later without changing the domain model:

- remain on `clipper2`
- move to lower-level Clipper bindings
- replace the engine entirely

## Raster Oracle And Candidate Acceptance

The exact raster oracle must be part of the first Rust cut.

The safest long-term direction is:

- geometry proposes candidate removals or fragments
- the raster helper/oracle validates whether those candidates are acceptable
- Rust owns both pieces so they share exactly the same replay semantics

The first cut therefore should not preserve the TypeScript split where geometry
and oracle correctness live in different runtimes.

The Rust core should consolidate:

- exact stroke normalization
- raster coverage calculation
- raster guard preset resolution
- exact oracle validation
- candidate acceptance policy

This gives one consistent correctness model across prod-like research and exact
compaction.

## Build And Tooling

## Rust Build Shape

The repo should add a Cargo workspace for the new Rust crates.

Recommended outputs:

- ESM-compatible bundler target for browser and server consumption through Vite
  and the worker runtime

The canonical generated artifact location should be inside the runtime package,
for example:

- `packages/stroke-json-runtime/generated/wasm/`

The root `stroke-json:wasm:build` script is the only command allowed to write to
that generated directory. The runtime package imports the generated WASM glue
only from that location.

Generated bindings are build-only artifacts.

- they should be `.gitignore`d rather than committed
- the repo should provide a deterministic clean step that removes them
- any gate that depends on them must regenerate them through
  `stroke-json:wasm:build` before running

This policy keeps clean-clone checks reproducible and prevents persistent VPS
working trees from accumulating dirty tracked changes after deploys.

## Rust Reproducibility Contract

Because the repo builds on developer machines, CI, and the VPS itself, the Rust
toolchain must be reproducible rather than left implicit.

Requirements:

- commit `Cargo.lock`
- add `rust-toolchain.toml` to pin the Rust toolchain channel
- require the `wasm32-unknown-unknown` target
- provision `wasm-pack` through a repo-owned scripted install path such as
  `cargo install --locked wasm-pack --version $PINNED_WASM_PACK_VERSION`
- validate that exact pinned `wasm-pack` version in dev, CI, and VPS flows
- run locked Cargo commands in check, test, and build flows wherever supported

The deploy/install validation should therefore confirm not just that Rust tools
exist, but that the required target and reproducibility inputs are present.

The simplest first-cut build path is:

```text
Cargo workspace
  -> stroke-json-core
  -> stroke-json-wasm
  -> wasm-pack target bundler
```

The app build should depend on one explicit workspace script, for example:

- `bun run stroke-json:wasm:build`

The root quality gates should expand accordingly so Rust and the runtime package
participate in the same top-level checks. Representative additions are:

- Rust formatting, lint, and test scripts
- runtime package typecheck, lint, and test scripts
- root aggregate scripts that invoke those checks before the existing web app
  gates complete

The canonical workspace entrypoints should then become:

- root `format`
  - runs Rust formatting
  - then runtime package formatting
  - then existing web formatting
- root `lint`
  - runs Rust linting
  - then runtime package linting
  - then existing web linting
- root `build`
  - runs `stroke-json:wasm:build`
  - then runs the web production build
- root `check`
  - runs Rust checks
  - then runtime package checks
  - then existing web checks
- root `test`
  - runs Rust tests
  - then runtime package tests
  - then existing web tests

The production build then becomes:

1. build Rust/WASM artifacts
2. run existing app build

During the first adoption slice, that production build is not sufficient as the
only gate because the initial browser consumer lives under `/demo`, and the
current production build intentionally excludes demo routes.

Until a non-demo product route depends on the runtime, the repo must also run a
clean full-app build that includes demo routes, plus a worker/WASM initialization
smoke test for the demo/browser path.

## Server Runtime Loading Model

The first cut must choose an explicit server packaging model for the existing
`adapter-node` deployment path.

Use an ESM-compatible bundler model for both browser and server consumption.

`packages/stroke-json-runtime` should expose dedicated browser and server
entrypoints, but both are built on top of the same bundler-target WASM output.

Normative first-cut SSR packaging path:

- `stroke-json:wasm:build` emits one bundler-target ESM wrapper and one `.wasm`
  binary into `packages/stroke-json-runtime/generated/wasm/`
- `packages/stroke-json-runtime/src/server.ts` imports that generated ESM
  wrapper and exposes a memoized async initialization function for server calls
- `apps/web/vite.config.ts` keeps `@not-the-louvre/stroke-json-runtime` inside
  the SSR bundle path so Vite owns `.wasm` emission for the adapter-node build
- the adapter-node build emits the bundled server runtime plus its referenced
  `.wasm` asset under `apps/web/build/server/`
- server initialization stays lazy and memoized so the runtime is loaded on the
  first real stroke-json server call rather than eagerly during unrelated
  process startup

For the `apps/web` server build:

- `packages/stroke-json-runtime` must be bundled into the server build as an
  ESM-compatible SSR dependency rather than treated as a generic external module
- `apps/web` Vite SSR config must keep that runtime package inside the bundle
  path so the generated `.wasm` artifact is emitted into the production build
- the built adapter-node server must load the emitted WASM asset through the
  bundled server entrypoint, not through ad hoc relative filesystem guesses at
  runtime

This is preferred in the first cut because it stays compatible with the current
ESM `adapter-node` runtime and avoids mixing CommonJS-style server glue into an
otherwise ESM server build.

Build and deploy validation must prove that the server runtime is loadable
before restart. At minimum, the deployment flow should check for the expected
generated WASM build artifacts, and it must run a clean-build smoke test that
imports the bundled server runtime after `bun install --frozen-lockfile`,
`bun run stroke-json:wasm:build`, and `bun run build`.

That smoke test should initialize the built server runtime through its bundled
server entrypoint rather than merely checking that files exist on disk.

## Toolchain Prerequisites

Hosts that build the app must already have:

- `rustc`
- `cargo`
- `wasm-pack`

The install and deploy workflow should validate those tools and fail clearly if
they are missing.

The install script should not attempt to install Rust automatically. That adds
too much environment-specific fragility for the first cut.

## VPS Install And Deploy Integration

The production wrapper script at `scripts/deploy/vps.sh` should remain thin.
The real deployment integration belongs in `apps/web/scripts/deploy/vps-admin.ts`,
because that file already owns `install` and `deploy` behavior.

The deploy flow should become:

1. optional `git pull --ff-only`
2. `bun install --frozen-lockfile`
3. `bun run build`
4. restart the service

The install flow should validate the Rust toolchain alongside the existing host
requirements.

This keeps production compiling exactly the same artifacts that development and
CI compile.

## Error Handling

## No Silent TypeScript Fallbacks

If Rust is the source of truth, the app must not silently fall back to an older
TypeScript implementation for the same operation.

If the worker or WASM module fails to initialize, the dependent action should
fail clearly.

If a persistence or compaction request fails on the server, the request should
be rejected with a structured error.

## Stable Error Categories

The Rust/WASM layer should expose stable machine-usable error categories such as:

- `init_failed`
- `invalid_document`
- `document_limits_exceeded`
- `geometry_engine_failed`
- `raster_oracle_failed`
- `compression_failed`
- `internal_error`

The JavaScript layers may still display richer copy, but they should not need to
parse arbitrary error text to know what happened.

## Error Translation Ownership

Rust owns low-level error categorization. TypeScript adapters own translation
into worker-facing and server-facing error contracts.

Required server translation table for stroke-json failures:

- `invalid_document`
  - HTTP `400`
  - app code `INVALID_DRAWING_DOCUMENT`
- `document_limits_exceeded`
  - HTTP `413`
  - app code `DRAWING_DOCUMENT_TOO_LARGE`
- `compression_failed`
  - decode/input path: HTTP `400`, app code `INVALID_DRAWING_DOCUMENT_PAYLOAD`
  - encode/storage path: HTTP `500`, app code `PERSISTENCE_ENCODING_FAILED`
- `geometry_engine_failed`
  - HTTP `500`
  - app code `DRAWING_COMPACTION_FAILED`
- `raster_oracle_failed`
  - HTTP `500`
  - app code `DRAWING_COMPACTION_FAILED`
- `init_failed`
  - HTTP `500`
  - app code `STROKE_JSON_RUNTIME_FAILED`
- `internal_error`
  - HTTP `500`
  - app code `STROKE_JSON_RUNTIME_FAILED`

For browser worker consumers, the runtime package should expose stable worker
error codes derived from the same Rust categories without leaking transport- or
HTTP-specific details.

Contract tests must assert these translations so browser and server integrations
do not drift.

## Testing Strategy

## Rust Tests

Rust must carry the deepest behavioral coverage.

Add focused tests for:

- document parsing and validation
- V1 and V2 normalization semantics
- canonical serialization
- compression and decompression limits
- exact stroke normalization
- phase 1 simplification
- phase 2 geometry behavior
- raster guard preset behavior
- exact raster oracle behavior
- prod-like pipeline iteration behavior
- client publish preparation with protected-tail retention
- server validation and encoding of already-prepared V2 without reapplying
  client compaction policy

## Golden And Parity Fixtures

Introduce shared fixture documents that represent:

- tiny valid examples
- malformed documents
- large realistic editable V2 documents
- geometry edge cases
- oracle edge cases

Golden tests should compare canonical JSON and compacted output so the migration
does not drift silently.

The fixture set must explicitly cover the repo's migration-sensitive product
contracts:

- protected-tail publish semantics
- editable V1-to-V2 hydration semantics
- local draft migration semantics
- persistence of already-prepared V2 without backend compaction-policy replay
- browser and server render parity against Rust-owned oracle semantics for
  representative drawings
- persisted base64-plus-gzip payload compatibility for legacy V1, editable V2,
  and already-prepared V2 examples taken from current storage outputs

The existing TypeScript behavior can be used initially as migration reference
fixtures, but once Rust becomes authoritative the golden results are defined by
Rust-owned outputs.

The compatibility suite must also prove that:

- existing stored base64 payloads decode correctly through the new TypeScript
  wrapper plus Rust stack
- re-encoding preserves the agreed base64-plus-gzip storage contract for legacy
  V1, editable V2, and already-prepared V2 inputs

## TypeScript Contract Tests

TypeScript should test the runtime wrapper rather than re-testing algorithms.

Coverage should include:

- worker request/response routing
- stale-response handling
- WASM initialization failures
- server runtime loading
- boundary result decoding
- runtime package checks alongside the existing web app checks

## Product Integration Tests

End-to-end product coverage should confirm that:

- the stroke-json demo uses the Rust-backed worker path
- publish/save flows submit Rust-produced payloads
- the backend accepts and persists Rust-produced compact payloads
- large seeded drafts can be processed without main-thread algorithm work
- browser previews and server media rendering remain visually aligned with the
  Rust-owned oracle on representative fixtures

## Migration Plan

Rollout should happen in small, reversible slices.

### Slice 1: Rust Core Skeleton

- add Cargo workspace
- add document models, validation, canonical serialization, and compression
- add fixture and golden coverage

### Slice 2: Exact Oracle In Rust

- port exact normalization and raster helper logic
- port raster guard and exact oracle behavior
- validate parity on existing compaction scenarios

### Slice 3: Approximate Pipeline In Rust

- add `simplify-polyline`
- add `clipper2` adapter
- port prod-like pipeline orchestration and metrics

### Slice 4: Browser Integration

- add worker-backed runtime package
- wire `/demo/stroke-json` to Rust operations
- remove demo dependence on TypeScript algorithm modules
- keep a full-build browser/runtime smoke gate in place until a non-demo route
  also depends on the runtime

### Slice 5: Product And Backend Adoption

- route storage/publish helpers through Rust
- route backend confirm/save validation and storage encoding through Rust
- preserve the same persistence contract end to end

### Slice 6: Duplicate Code Removal

- remove TypeScript algorithm implementations from shared stroke-json modules
- keep only adapters, types, and presentation/integration helpers where still
  needed

The migration is complete only when TypeScript no longer contains a second
implementation of stroke-json correctness logic.

## Risks And Mitigations

## Geometry Engine Maturity

`clipper2` is a reasonable first-cut choice, but it still carries some maturity
and API-evolution risk.

Mitigation:

- hide it behind an internal adapter
- lock migration progress behind fixture parity and oracle validation

## Build Complexity Growth

Adding Rust and WASM can easily become operationally noisy.

Mitigation:

- keep only one explicit WASM build script for app consumers
- make VPS deploy reuse that exact script
- do not introduce a separate native-server build in the first cut

## Boundary Cost On Large Payloads

WASM can still underperform if large object graphs are bounced back and forth
between runtimes.

Mitigation:

- prefer bytes and canonical JSON over deep JS object exchange
- expose coarse-grained operations only
- keep processing inside Rust until the final result is ready

## Operational Outcome

After this design is implemented:

- Rust is the only authority for stroke-json correctness
- browser heavy processing runs off the main thread
- backend and browser share the same core logic
- deploy/install scripts know how to build the Rust artifacts before the app
- the repo no longer carries two independent implementations of the same
  stroke-json behavior