## Why

Large artworks and large forks currently become difficult to edit because each
pointer move clones the full drawing document, replays the full canvas, and can
trigger full draft persistence. That makes the hot path scale with total
document size, which degrades stroke smoothness exactly where the product most
needs fidelity-preserving continuation.

The product has already committed to Stroke JSON and lossless publish
compaction as non-negotiable. The missing piece is an editor-side performance
mode that restores responsive drawing for large documents without weakening the
canonical document or publish contract.

## What Changes

- Introduce an automatic performance mode for large drawing documents in the
  studio and avatar sketch flows.
- Keep the active stroke in transient canvas-local state during pointer
  interaction instead of mutating the canonical drawing document on every move.
- Commit the canonical document, parent sync, and draft persistence at stroke
  boundaries rather than point-by-point.
- Add a raster cache for already committed content so large documents do not
  require full-document replay while a user is actively drawing.
- Add regression coverage for large hydrated documents, fork continuation, and
  draft persistence semantics under performance mode.

## Capabilities

### New Capabilities
- `responsive-drawing-editing`: large studio and avatar drawings remain
  responsive during active editing while keeping Stroke JSON as the only source
  of truth for draft recovery and publish preparation.

### Modified Capabilities

None.

## Impact

- Affected code: `apps/web/src/lib/features/studio-drawing/components/DrawingCanvas.svelte`, `apps/web/src/lib/features/studio-drawing/StudioDrawingPage.svelte`, `apps/web/src/lib/features/home-entry-scene/components/AvatarSketchpad.svelte`, `apps/web/src/lib/features/stroke-json/canvas.ts`, draft helpers, and browser/component test suites.
- Affected systems: studio drawing, avatar sketch editing, local draft persistence, large fork continuation, and browser-side rendering performance.
- Affected dependencies: no new external dependency is expected; the change primarily restructures existing client-side drawing state and rendering flow.