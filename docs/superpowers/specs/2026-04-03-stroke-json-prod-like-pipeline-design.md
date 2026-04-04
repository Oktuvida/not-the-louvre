# Stroke JSON Prod-Like Iteration Pipeline

**Date:** 2026-04-03
**Status:** Proposed

## Context

The stroke JSON lab currently exposes three different categories of behavior in
the same surface:

- bitmap and JSON cloning experiments
- an exact lossless compaction action backed by the raster oracle in
  `compaction.ts`
- exploratory phase 1 and phase 2 benchmark controls

That exact lossless compaction path is still useful as a correctness oracle, but
it is no longer the path the product wants to approximate in the near term.
The selected future-oriented pipeline for the lab is:

- phase 1: `simplify-js`
- simplification tolerance: `0.5`
- high quality mode: `true`
- phase 2: Clipper 2

The lab must now reflect that decision directly. Instead of a single one-off
lossless compaction action, the primary compaction surface should show how the
selected future pipeline behaves when applied repeatedly to its own output.

The user explicitly wants chained iteration semantics, not repeated timing over
the same baseline input. The user also explicitly wants these pipeline settings
expressed as named constants rather than inline magic numbers or booleans.

## Decision

Replace the current `Run lossless compaction` demo action with a dedicated
`Run 20x prod-like pipeline` action.

That action runs 20 chained passes of the selected future pipeline against the
current working drawing document:

1. run phase 1 with `simplify-js`
2. use tolerance `0.5`
3. use high quality mode `true`
4. run phase 2 with Clipper 2
5. feed the resulting document into the next pass

The lab shows:

- a final-output summary for the pass-20 result
- a preview of the final pass output
- a per-iteration table with one row per pass

The exploratory benchmark sections remain available as research surfaces, but
they are no longer presented as the main product-like path.

## Goals

- Make the chosen future pipeline explicit in the lab UI.
- Show chained iteration behavior instead of a single one-off compaction run.
- Make cumulative drift and convergence visible by comparing every pass against
  the original baseline input.
- Keep all pipeline parameters expressed as named constants instead of inline
  literals.
- Preserve the current research value of the lab without mixing the chosen path
  into the exploratory benchmark tables.

## Non-Goals

- Replacing the exact lossless compactor implementation in `compaction.ts`.
- Shipping the future pipeline as the canonical persistence path in production.
- Implementing the future WASM-backed version in this change.
- Making the prod-like pipeline fully user-configurable from the UI.
- Redesigning bitmap or JSON clone experiments.

## UI Surface

## Primary Pipeline Block

The main compaction area in the lab becomes a dedicated prod-like pipeline
block.

- Remove the `Run lossless compaction` button from the visible demo controls.
- Add a new primary button labeled `Run 20x prod-like pipeline`.
- Keep the bitmap and JSON clone actions unchanged.
- Keep the exploratory phase 1 and phase 2 comparison controls in their own
  separate benchmark sections.

The dedicated pipeline block contains two subareas:

1. a final result summary
2. an iteration history table

## Final Result Summary

The final result summary represents pass 20 only.

It includes:

- final preview image
- final raw JSON bytes
- final gzip bytes
- final stroke count
- final point count
- final diff pixels relative to the original baseline document
- total accumulated runtime across all 20 passes
- final-pass runtime

This area answers the product question: what did the pipeline converge to after
repeated application?

## Iteration History Table

The table contains exactly 20 rows, one per chained pass.

Each row includes:

- pass number
- runtime for that pass only
- stroke count after that pass
- point count after that pass
- raw bytes after that pass
- gzip bytes after that pass
- diff pixels relative to the original baseline document

The table is the primary tool for inspecting whether repeated application is
stable, convergent, or visibly degrading.

## UI States

The dedicated block has four explicit states:

- idle: no prod-like pipeline run has been executed yet
- running: the chained run is in progress and the action button is disabled
- done: the final summary and full table are available
- error: the run aborted and the block shows an error message

Starting a new run clears the previous prod-like pipeline results before new
results are rendered. This prevents stale previews or stale tables from being
interpreted as part of the current run.

Starting a new run also clears any prior prod-like pipeline error state. A
retry behaves like a fresh run, not like a continuation of a failed run.

## Constants

The selected prod-like pipeline settings must be represented by exported named
constants, not inline literals in the Svelte component or helper code.

At minimum, the design requires constants for:

- iteration count
- phase 1 algorithm identity
- phase 1 simplify tolerance
- phase 1 high quality flag
- phase 2 engine identity

Representative names are:

- `PROD_LIKE_PIPELINE_ITERATION_COUNT`
- `PROD_LIKE_PHASE1_ALGORITHM_ID`
- `PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE`
- `PROD_LIKE_PHASE1_HIGH_QUALITY`
- `PROD_LIKE_PHASE2_ENGINE_ID`

The button label should derive from the iteration-count constant so the visible
copy and the actual orchestration cannot drift apart.

## Orchestration Architecture

The chained prod-like run should not be implemented inline inside
`StrokeJsonLab.svelte`.

Introduce a dedicated helper module that owns the fixed future-pipeline flow.
This helper is responsible for:

- normalizing the input document as needed
- running the selected phase 1 simplification step
- running the selected phase 2 geometry step with Clipper 2 only
- measuring per-pass runtime
- calculating post-pass document metrics
- returning both the final document and the full iteration history

This keeps the Svelte component focused on interaction state and presentation.

## Data Model

The helper should return a structured result with:

- the original baseline document used for diffing
- the final document after pass 20
- an ordered list of iteration results
- aggregate timing for the whole run

Each iteration result should include at least:

- pass number
- resulting document
- duration in milliseconds
- stroke count
- point count
- raw byte count
- gzip byte count

The helper remains document-centric. It returns documents and numeric metrics,
not rendered bitmaps or preview URLs. Preview rendering and canvas-based diff
measurement remain the responsibility of the Svelte lab component.

## Baseline Diff Semantics

Every iteration diff is measured against the original baseline document, not the
previous pass.

This is intentional.

Comparing pass `n` to pass `n - 1` only shows local change. Comparing every pass
to the original input shows cumulative drift, which is the product question the
user wants answered.

## Phase Reuse and Refactoring

The existing benchmarking helpers already know how to run the relevant
algorithms, but they are currently organized for comparison mode rather than for
single-path orchestration.

Implementation may refactor these helpers so the prod-like runner can reuse:

- a single fixed `simplify-js` execution path
- a single fixed Clipper 2 execution path

The design does not require preserving the exact current helper boundaries. It
does require keeping responsibilities clear:

- shared algorithm execution belongs in reusable helper modules
- chained orchestration belongs in the dedicated prod-like pipeline helper
- presentation and preview rendering belong in the Svelte lab component

## Error Handling

If any pass fails, the chained run stops immediately and the dedicated block
enters an error state.

The error state should:

- preserve the rest of the lab surface
- avoid corrupting benchmark comparison state
- show a clear message that the prod-like run failed
- avoid displaying partial results as if they were a complete 20-pass run

The implementation may optionally include the pass number in the error message
if that can be done without clutter.

## Testing Strategy

## Unit Coverage

Add focused unit coverage for the prod-like orchestration helper.

The tests should verify:

- the helper returns the expected number of iteration rows
- chained semantics are respected, with each pass using the previous pass
  output as input
- the final document matches the last iteration document
- the exported constants define the selected fixed pipeline parameters
- failure during an intermediate pass rejects the run instead of pretending a
  full result exists

These tests should avoid brittle assertions about exact byte values for complex
drawings unless the fixture is intentionally tiny and deterministic.

## End-to-End Coverage

Update the stroke-json demo Playwright test so it verifies:

- the new prod-like pipeline button is visible
- the old lossless demo button is no longer the main visible action
- running the pipeline fills final-result metrics
- the iteration table renders 20 rows
- the final preview appears

The E2E should remain tolerant of metric-value variance where appropriate, but
it should verify that the pipeline produces concrete results instead of pending
placeholders.

## Implementation Notes

- The exact lossless compactor remains available in code as the correctness
  oracle and should not be removed from the codebase.
- The prod-like pipeline is a lab-facing experiment surface, not a production
  persistence commitment.
- The current future-direction choice may later move to WASM, but this change
  only restructures the lab around the TypeScript-based selection.

## Acceptance Criteria

- The lab exposes `Run 20x prod-like pipeline` as the replacement for the prior
  lossless compaction demo action.
- That action executes 20 chained passes of `simplify-js` plus Clipper 2.
- The selected settings are represented by named constants, not inline literals.
- The final result block shows preview and final metrics for pass 20.
- The iteration table shows 20 rows with per-pass metrics.
- Diff pixels are computed against the original baseline input for every row.
- A failed pass puts the dedicated block into an error state without corrupting
  the rest of the lab.
- Focused unit and demo E2E coverage exist for the new behavior.