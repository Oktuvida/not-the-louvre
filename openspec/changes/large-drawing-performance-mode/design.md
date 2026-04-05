## Context

Large studio drawings, especially large forks, currently degrade during active
editing because most pointer moves trigger work proportional to the full
document size: clone the canonical `DrawingDocumentV2`, notify parent state,
replay the full canvas, and persist the full draft. The result is visible input
lag and straight-line looking strokes even though the underlying publish path
and Stroke JSON model are correct.

This change must improve edit-time responsiveness without changing the product's
non-negotiable constraints: Stroke JSON remains the only source of truth,
lossless publish compaction remains unchanged, and persisted draft/publish
payloads must continue to derive from the canonical document rather than any
render-only artifact. The same problem exists in the avatar sketch surface,
although the studio path is the higher-risk case because large inherited fork
bases surface it more often.

## Goals / Non-Goals

**Goals:**
- Keep active drawing work near amortized `O(1)` per point for large documents.
- Preserve exact point capture and the current canonical Stroke JSON publish
  contract.
- Reduce parent-state churn and draft writes during active strokes.
- Apply one responsive editing architecture across studio and avatar sketch
  surfaces where practical.
- Make the mode activate automatically for sufficiently large drawings instead
  of relying on user choice.

**Non-Goals:**
- Replacing Stroke JSON with bitmap state.
- Weakening, approximating, or bypassing lossless publish preparation.
- Changing persisted draft schema or publish payload shape.
- Moving drawing execution to an offscreen worker in this change.
- Adding undo/redo or broader editor feature work.

## Decisions

### 1. Keep the active stroke outside the canonical document until stroke boundaries

The editor will buffer the active stroke in transient canvas-local state during
pointer interaction. The canonical `DrawingDocumentV2` will update when a
stroke is committed, not on every move. This removes repeated whole-document
cloning and parent notifications from the hot path while preserving exact point
data at commit time.

Alternative considered: keep point-by-point canonical commits and only optimize
cloning or paint loops. Rejected because the parent sync and draft save
contracts would still make pointer handling scale with total document size.

### 2. Use a raster cache only for already committed content

Committed content will be rendered into a reusable canvas cache. During active
drawing, the editor will repaint from that committed cache and then overlay the
buffered active stroke. The cache is an acceleration layer only; it is never
used as persistence or publish input.

Alternative considered: continue replaying the full canonical document on each
frame. Rejected because large hydrated documents make full replay the dominant
cost. Alternative considered: treat the raster cache as the editable source of
truth. Rejected because it breaks the product's fidelity guarantees.

### 3. Activate responsive editing automatically from large-document heuristics

Responsive editing will turn on automatically when document size or replay cost
crosses configured thresholds. Initial activation will be size-first
(stroke-count / point-count / hydrated-base thresholds) with render-cost as a
secondary safeguard for slower devices. This keeps the default path simple for
small drawings while protecting large originals and large forks without manual
mode switching.

Alternative considered: a user-facing toggle. Rejected because the problem is
primarily technical, would be hard for users to diagnose, and would create
inconsistent bug reports. Alternative considered: fork-only activation.
Rejected because large non-fork drawings suffer from the same hot path.

### 4. Align parent sync and draft persistence to canonical commits

When responsive editing is active, parent synchronization and draft persistence
will happen from completed canonical strokes instead of point-by-point updates.
The accepted trade-off is that a crash mid-stroke may lose only the in-progress
stroke, not the entire document.

Alternative considered: continue point-by-point autosave. Rejected because it
reintroduces the same write amplification and serialized document churn that the
change is removing. Alternative considered: periodic mid-stroke flushes from the
start. Rejected for the first cut because stroke-boundary commits are simpler
and already satisfy the current product requirement.

### 5. Roll out through a shared pipeline with studio-first validation

The implementation will prove the new pipeline in the studio editor first,
where large fork hydration is easiest to reproduce and measure, then apply the
same contract to avatar sketching with shared helper logic where possible. This
keeps the architecture unified while reducing the blast radius of the first
cut.

Alternative considered: duplicate separate implementations in studio and avatar
flows. Rejected because drift would be likely and future fixes would need to be
ported twice.

## Risks / Trade-offs

- Cache invalidation gaps could show stale committed visuals -> Rebuild or clear
  responsive-editing render state on hydration changes, stroke commits, clears,
  and fork-reset boundaries, with component and browser regression coverage.
- Mid-stroke crashes can lose the active stroke -> Limit deferred persistence to
  the in-progress stroke only and preserve completed canonical strokes exactly
  as today.
- Thresholds may under- or over-activate the mode on different devices -> Start
  with conservative size thresholds and keep a render-cost fallback for slower
  devices.
- Studio and avatar surfaces may diverge if contracts are copied instead of
  shared -> Centralize shared helpers or test contracts before porting avatar.

## Migration Plan

1. Introduce transient active-stroke state and explicit stroke-commit
   boundaries in the studio drawing canvas while keeping the canonical document
   and publish path unchanged.
2. Change studio parent sync and draft persistence so they run once per
   completed stroke, then add component tests proving intermediate pointer moves
   do not rewrite canonical state.
3. Add committed-content raster caching and automatic large-document activation
   heuristics for studio hydration and fork continuation flows.
4. Apply the same responsive editing contract to avatar sketching using shared
   helpers or equivalent shared tests.
5. Add browser regressions for dense drawing over large hydrated bases and run
   the full format, lint, check, and test gates.

Rollback strategy:
- Keep the canonical drawing document, draft format, and publish preparation
  contract unchanged so rollback is a code-path rollback rather than a data
  migration.
- Land the new path behind automatic heuristics only; reverting the editor to
  full replay remains possible until the old hot path is removed.

## Open Questions

- Whether ultra-long single strokes need a later `requestAnimationFrame`
  consolidation path in addition to stroke-boundary commits.
- The final threshold constants to use on desktop and mobile once dense-drawing
  regressions are measured on real hardware.
- Whether the shared responsive-editing helpers should live next to
  `DrawingCanvas.svelte` first or move into a lower-level shared module before
  the avatar port.