# Large Drawing Performance Strategy

**Date:** 2026-04-05
**Status:** Proposed

## Problem

Large artworks, especially large forked artworks, currently degrade drawing
responsiveness in the studio. The visible symptom is that strokes stop feeling
smooth and instead appear as straight segments or delayed "autocomplete"
lines.

The issue is not publish-time compaction. The issue is the edit-time hot path.
Today, each pointer move does work proportional to the size of the whole
document:

- clone the full `DrawingDocumentV2`
- notify the parent with another full clone
- redraw the entire canvas from the full document
- trigger synchronous draft persistence of the full document

That makes per-point editing effectively `O(total document size)` instead of
amortized `O(1)` for the active stroke.

This affects all large drawings, not just forks. Forks simply surface it more
often because they start with a heavy inherited base.

## Decision

Introduce a performance drawing mode for large documents.

- The source of truth remains the editable `DrawingDocumentV2`.
- Lossless publish compaction remains mandatory and unchanged.
- Large-document editing uses a raster cache of already committed content only
  as a rendering acceleration layer.
- The active stroke lives in a temporary in-memory buffer while the user is
  drawing.
- The canonical document is consolidated at stroke boundaries or batched frame
  boundaries instead of on every pointer event.
- Draft persistence no longer runs point-by-point.

This preserves publish fidelity because the published payload still comes from
Stroke JSON, not from the raster cache.

## Goals

- Restore smooth drawing for large artworks and large forks.
- Keep per-point hot-path work close to `O(1)`.
- Preserve the existing lossless publish contract.
- Avoid quality loss by keeping Stroke JSON as the only source of truth for
  save and publish.
- Generalize the strategy to all large drawings, not only fork flows.

## Non-Goals

- Replacing the Stroke JSON source of truth with a bitmap.
- Weakening or bypassing lossless publish compaction.
- Adding undo/redo in this change.
- Moving drawing to an offscreen worker as the first step.
- Reworking the publish contract or the draft schema.

## Current Hot Path

The studio drawing path currently does this on most pointer moves:

1. resolve pointer coordinates inside canvas bounds
2. clone the entire `drawingDocument`
3. append the point to the newest tail stroke
4. clone again for parent sync
5. clear and repaint the full canvas from all renderable strokes
6. cascade into draft persistence for the full document

That means a single new point is cheap in isolation but expensive in context.
The cost grows with accumulated strokes and points.

## Proposed Architecture

### 1. Canonical Document State

`drawingDocument` remains the canonical editable state, but it stops changing on
every pointer event.

- It is updated when a stroke is committed.
- It may also be updated on a batched `requestAnimationFrame` boundary if a
  future refinement needs mid-stroke consolidation.
- It remains the only input to draft persistence and publish preparation.

### 2. Active Stroke State

Introduce a temporary active-stroke buffer local to the canvas component.

- `activeStrokePoints`
- `activeStrokeColor`
- `activeStrokeSize`
- `isStrokeDirty`

This state exists only while the user is actively drawing.

Appending to `activeStrokePoints` should be amortized `O(1)`.

### 3. Raster Cache For Committed Content

Introduce a render cache for already committed content.

- The cache contains a rasterized rendering of the currently committed document.
- For large documents, this cache is reused during active drawing.
- The active stroke is painted on top of the cached base.
- The cache is rebuilt only when the canonical document is consolidated,
  cleared, fork-cancelled, or hydrated with a different seed.

This cache is only an edit-time acceleration layer. It is never used as the
input for persistence or publish.

### 4. Incremental Active Stroke Rendering

While the user is drawing:

- repaint from the cached committed layer
- paint only the in-progress active stroke overlay

The first version may redraw the whole active stroke buffer each frame while
still avoiding full-document replay. If needed later, the active overlay can be
reduced further to segment-only incremental drawing.

### 5. Deferred Persistence

Draft persistence changes from point-by-point to stroke-boundary persistence.

- No draft save on every pointer move.
- Save on `pointerup`.
- Optionally save on batched `requestAnimationFrame` consolidation if we add
  mid-stroke flushes later.

This accepts losing only the currently unfinished stroke if the tab crashes in
the middle of drawing.

## Activation Heuristic

Performance mode should be automatic for any sufficiently large drawing.

Activate when any of these are true:

- renderable stroke count exceeds `250`
- total point count exceeds `5_000`
- inherited or hydrated base exceeds `2_500` points
- initial full-document render exceeds roughly `8ms` on desktop or `12ms` on
  mobile

The size thresholds should be the initial gate. Render-time measurement is a
secondary safeguard for slower devices.

## Data Flow

### Pointer Down

- resolve the first point
- initialize `activeStrokePoints`
- mark drawing as active
- do not clone the canonical document yet
- do not autosave

### Pointer Move

- append the point to `activeStrokePoints`
- ignore exact duplicates
- render cached committed content plus the active stroke overlay
- do not write drafts
- do not notify parent state on every point

### Pointer Up

- convert the active stroke buffer into a canonical tail stroke
- apply one document commit
- rebuild the committed raster cache
- notify parent state once
- persist the draft once
- clear the active stroke buffer

## Fork Behavior

Forks follow the same model as any large drawing.

- The inherited fork content is part of the committed document and is eligible
  for raster caching during edit.
- The cache is rebuilt from Stroke JSON after hydration, not from published
  media.
- Publish still uses the canonical document plus lossless compaction, never the
  raster cache.

This avoids reintroducing bitmap-as-source-of-truth behavior.

## Avatar Behavior

The same architecture can be applied to avatar editing.

- The avatar silhouette and background remain visual guide layers.
- The editable source remains Stroke JSON.
- Performance mode may activate at lower thresholds because the device class is
  often mobile and the editor runs in a modal.

The studio and avatar canvases should converge toward the same drawing pipeline
where practical.

## Testing Strategy

### Unit And Component Coverage

- active-stroke buffering does not mutate canonical document on every move
- canonical document commits once per finished stroke
- draft save does not fire per point
- clearing and fork cancellation invalidate both canonical and cached state
- large hydrated drawings still preserve exact point data when committed

### Browser Performance Regressions

- forked large document remains interactive during dense drawing
- large non-fork artwork remains interactive during dense drawing
- in-progress strokes remain visually smooth under heavy base documents

### Fidelity Checks

- publish payload stays derived from the canonical document
- performance mode does not change final publish output
- cache rebuild after commit matches full replay output

## Implementation Order

1. Add active-stroke buffer state to the drawing canvas.
2. Stop canonical document commits on every pointer move.
3. Persist drafts only on stroke commit.
4. Add raster cache for committed content.
5. Gate the mode behind size heuristics for all large drawings.
6. Port the same approach to avatar editing.
7. Add browser-level regressions for large-document drawing smoothness.

## Risks

- Canvas cache invalidation bugs could show stale visuals if rebuild triggers are
  incomplete.
- Stroke commit boundaries must be handled carefully for cancel, blur, and clear.
- Parent state that currently assumes point-by-point sync may need small
  contract adjustments.
- Overeager heuristics could add complexity for documents that do not need the
  mode.

## Recommendation

Implement the performance mode exactly as an edit-time optimization layer.

- Keep lossless compaction and publish semantics unchanged.
- Keep Stroke JSON as the only source of truth.
- Use raster caching only for already committed content.
- Treat the active stroke as transient UI state until consolidation.

This is the smallest architecture change that meaningfully improves drawing
latency for large artworks without compromising fidelity or product guarantees.