# Stroke JSON Canvas Source Of Truth

**Date:** 2026-03-30
**Status:** Proposed

## Problem

The current drawing flows use raster images as the source of truth. Both the
artwork studio and avatar editor redraw on top of an already exported image and
then export again through a lossy browser format. Repeating that loop causes
visible degradation, especially for avatar editing and repeated artwork forks.

The current implementation makes this unavoidable:

- the draw studio preloads a parent artwork from image media and draws over it
- artwork publishing exports a compressed WebP before backend sanitization
- avatar editing reloads the saved avatar image and exports a new compressed
  bitmap again

That means every edit starts from a degraded bitmap instead of from the user's
original drawing instructions.

For a fast MVP, the product does not need undo/redo, pressure sensitivity,
layers, or a rich vector editor. It only needs a simple, reproducible source
format that can be replayed without cumulative quality loss and that is small
enough to store efficiently.

## Decision

Introduce a new drawing source format based on a minimal JSON stroke document.

- The source of truth becomes a compact JSON document containing ordered brush
  strokes.
- The document is validated strictly with `zod` plus aggregate payload limits.
- The persisted representation is the compact JSON compressed with `gzip`.
- Canvas bitmaps remain derived artifacts used only for compatibility with
  existing rendering surfaces, such as gallery media and 3D texture workflows.
- A research demo will prove the quality and size characteristics before wiring
  the format into product flows.

Because the product has not shipped to production yet, this design does not
need to support backward compatibility with an already-released hybrid model.
This can be treated as a clean replacement path.

## Goals

- Eliminate cumulative quality loss caused by repeatedly editing exported
  bitmaps.
- Keep the implementation KISS: no undo/redo, no SVG source format, no scene
  graph, and no custom binary codec in v1.
- Make the drawing source format safe to parse and bounded in size.
- Keep storage efficient enough for database persistence.
- Provide a demo route that compares bitmap-clone degradation against JSON
  replay across repeated iterations.

## Non-Goals

- Implementing undo/redo.
- Switching gallery or GLB texture consumers away from bitmap media in this
  change.
- Introducing SVG as the source-of-truth format.
- Designing a final database migration for product data.
- Solving advanced stroke rendering quality with a library such as
  `perfect-freehand` in v1.
- Supporting old released production data, since no production release exists
  yet.

## Source Format

### Canonical Document

The source of truth is `DrawingDocumentV1`.

```json
{
  "version": 1,
  "kind": "artwork",
  "width": 768,
  "height": 768,
  "background": "#fdfbf7",
  "strokes": [
    {
      "color": "#2d2420",
      "size": 5,
      "points": [[120, 88], [121, 89], [123, 91]]
    }
  ]
}
```

The avatar variant uses the same structure with avatar dimensions and avatar
background color.

### Fields

- `version`: integer schema version, starting at `1`
- `kind`: either `avatar` or `artwork`
- `width`: canonical source canvas width for the document kind
- `height`: canonical source canvas height for the document kind
- `background`: fixed background color for the document kind
- `strokes`: ordered array of drawn strokes

Each stroke contains:

- `color`: brush color
- `size`: brush size in pixels
- `points`: ordered array of integer point tuples `[x, y]`

### Deliberate Omissions

The first version intentionally excludes:

- undo/redo history
- timestamps
- pressure
- smoothing parameters
- blend modes
- SVG path payloads
- arbitrary metadata

The document should remain as close as possible to the current canvas drawing
behavior so that replay logic can stay simple.

## Validation And Security

### Schema Boundary

Validation uses `zod` as the schema boundary. The drawing document must never be
interpreted as code or injected into HTML. It is only:

1. parsed as JSON
2. validated against the schema
3. rendered by product-owned canvas code

This avoids the execution risks that would come with SVG as a document format.

### Strict Validation

The schema must enforce:

- `version === 1`
- `kind` restricted to `avatar | artwork`
- exact dimensions per `kind`
- exact or tightly restricted background color per `kind`
- brush size range
- point tuple shape `[x, y]`
- integer coordinates only
- coordinate bounds inside the canonical canvas
- valid colors, either strict hex or a defined allowed palette

### Aggregate Limits

Schema validation alone is not enough. The implementation must also reject
documents that are structurally valid but operationally abusive.

The backend should enforce limits such as:

- maximum compressed payload bytes
- maximum decompressed JSON bytes
- maximum stroke count
- maximum points per stroke
- maximum total points across the document

The safe processing order is:

1. reject oversized compressed payloads
2. decompress with an output cap
3. parse JSON
4. validate with `zod`
5. apply aggregate size and count limits
6. only then persist or replay

This protects the system from malformed documents and from very large but valid
payloads.

## Storage Strategy

### Compact JSON

The logical source format remains standard JSON. The serialized form should be
compact:

- no whitespace
- points stored as `[x, y]` tuples instead of objects
- integer coordinates
- style stored once per stroke instead of repeated per point

### Compression

The persisted representation is the compact JSON compressed with `gzip`.

This is the recommended v1 trade-off because it is:

- simple to implement
- widely available
- easy to inspect and debug
- effective for repetitive JSON payloads

The design explicitly avoids inventing a custom binary format or delta codec in
the first iteration.

### Metrics

The implementation should measure and expose:

- `jsonRawBytes`
- `jsonGzipBytes`
- `webpBytes`
- ratio of `jsonGzipBytes / webpBytes`

These metrics matter because storage cost is a core reason for the change, not
just quality preservation.

## Rendering Model

### Replay

Replay should use the same conceptual drawing model already present in the app:

- fill canvas background
- iterate strokes in order
- for each stroke, start a path and replay points via canvas path APIs

This keeps the new source format aligned with current behavior and avoids a
large visual gap between existing drawing UX and replayed output.

### Derived Bitmap

The bitmap stays in the system as a derived output. The source-of-truth drawing
document is replayed into a canvas, and that canvas can still be exported to
WebP and passed through the existing media pipeline where needed.

That means:

- JSON is the editable source
- bitmap is the compatibility artifact

## Demo Route

### Purpose

Before wiring the source format into product avatar and artwork flows, the repo
should include a research demo under `/demo/stroke-json`.

This route exists to answer two product questions quickly:

1. does JSON replay avoid repeated quality loss?
2. is the compressed JSON small enough to justify database storage?

### Scope

The demo includes:

- a simple editable canvas
- basic color selection
- basic brush size selection
- clear/reset behavior
- export and comparison metrics
- repeated clone experiments

The demo does not need backend integration or production-grade UX.

### Comparison Experiments

The demo should run two repeatable experiments:

#### Bitmap Clone

`canvas -> webp -> reload -> repeat x20`

This approximates the current degraded workflow.

#### JSON Clone

`json source -> replay -> preview bitmap -> repeat x20`

The JSON document remains the source of truth throughout the experiment.

### Visible Outputs

The demo should show:

- original drawing preview
- final result after 20 bitmap clones
- final result after 20 JSON replays
- JSON raw bytes
- JSON gzip bytes or a close estimate when available in-browser
- WebP bytes
- stroke count
- total point count

The goal is to make the quality and size trade-off visually and numerically
obvious.

## Production Isolation

The demo route should not ship as a visible production surface.

Recommended behavior:

- the route lives under `/demo/stroke-json`
- it is available only in development or behind an explicit non-production flag
- production builds should resolve it to `404` or an equivalent disabled state

This keeps the research artifact useful during development without leaking it as
product UI.

## Testing Strategy

### Unit Tests

At minimum, add tests for:

- schema validation acceptance of valid avatar and artwork documents
- schema rejection of invalid dimensions, colors, sizes, and point shapes
- aggregate limit rejection for oversized payloads
- round-trip replay from JSON to canvas output
- metric calculation for raw JSON, compressed JSON, and WebP outputs
- degradation comparison showing bitmap clone diverges materially more than JSON
  replay after repeated iterations

### Browser Test

Add a small browser or route-level test for the demo proving that a user can:

- draw on the canvas
- trigger the 20x bitmap clone experiment
- trigger the 20x JSON clone experiment
- see resulting metrics and comparison outputs

## Implementation Sequence

1. Define `DrawingDocumentV1` types and `zod` schemas.
2. Add pure utilities for serialize, parse, validate, compress, decompress, and
   replay.
3. Create `/demo/stroke-json` with drawing controls and comparison metrics.
4. Add tests covering validation, compression, and clone comparison behavior.
5. Use findings from the demo to drive the follow-up product change for avatar
   editing and artwork forking.

## Risks And Trade-Offs

- Simple canvas replay may not look as polished as a future stroke library, but
  that is acceptable for validating the storage and fidelity model.
- `gzip` may not be the final optimal storage representation, but it is the
  right KISS default for v1.
- Browser-side gzip estimation may vary depending on available APIs, so the demo
  may need to present an estimate locally and rely on backend tests for exact
  persisted values.
- Without undo/redo, the new model solves fidelity and storage concerns first,
  but does not yet improve editing ergonomics.

## Success Criteria

- A compact JSON stroke document can reproduce the same drawing without using a
  previously exported bitmap as source.
- The demo shows materially less visible degradation for JSON replay than for
  repeated WebP reloads.
- The demo reports raw JSON, compressed JSON, and WebP size metrics.
- Validation rejects malformed and oversized payloads.
- The design stays simple enough to wire into product surfaces without a large
  rendering dependency.