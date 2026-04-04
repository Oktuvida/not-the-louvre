# Stroke JSON V2 Lossless Compaction

**Date:** 2026-04-03
**Status:** Proposed

## Context

The current drawing source format preserves replay fidelity because it stores
ordered drawing instructions instead of a raster snapshot. That solves the
quality-loss problem introduced by bitmap re-editing.

However, the current `DrawingDocumentV1` model is append-only. Every new edit
adds more stroke data, even when old geometry is fully hidden by newer marks.
Forking and re-publishing therefore preserve fidelity but keep accumulating
historical drawing data that no longer contributes to the final rendered image.

We want a next version of the format that keeps the editable-source and
lossless-replay properties of the current model while avoiding unbounded growth.

This change starts in the research demo at `/demo/stroke-json`. The production
app is not wired to use the new format yet, but the reusable utilities must live
in production code so they can later be adopted by artwork publish, artwork
forking, and avatar save flows.

## Decision

Introduce `DrawingDocumentV2` with a canonical `base` plus `tail` structure and
ship a production-ready, lossless compaction pipeline.

- The system reads both `DrawingDocumentV1` and `DrawingDocumentV2`.
- The system writes and reserializes only `DrawingDocumentV2`.
- `DrawingDocumentV2` renders as `base` followed by `tail`.
- Compaction always produces a new `base` and clears `tail`.
- The production compactor must be lossless relative to product replay
  semantics. It must not rely on approximate RDP simplification.
- The demo route becomes the first validation surface for metrics, visual
  parity, and compaction behavior.

## Goals

- Keep the editable source as ordered drawing instructions instead of a bitmap.
- Reduce persisted storage growth by removing geometry that is provably
  redundant in the final render.
- Support universal read compatibility for both V1 and V2 documents.
- Make V2 the canonical output of every future write or rewrite path.
- Validate the approach in `/demo/stroke-json` before wiring production flows.

## Non-Goals

- Wiring the production artwork or avatar flows to V2 in this change.
- Using approximate `Ramer-Douglas-Peucker` simplification in the canonical
  production compactor.
- Introducing a custom binary format, delta codec, or background render queue.
- Reconstructing vector source from raster-only legacy media.
- Changing current drawing UX beyond what the demo needs for validation.

## Canonical Format

### DrawingDocumentV2

`DrawingDocumentV2` keeps the same fixed dimensions and background rules as V1,
but splits strokes into two ordered arrays.

```json
{
  "version": 2,
  "kind": "artwork",
  "width": 768,
  "height": 768,
  "background": "#fdfbf7",
  "base": [
    {
      "color": "#2d2420",
      "size": 12,
      "points": [[48, 48], [320, 320]]
    }
  ],
  "tail": [
    {
      "color": "#c84f4f",
      "size": 8,
      "points": [[300, 180], [420, 220]]
    }
  ]
}
```

Render semantics are explicit:

1. fill the background
2. replay `base` in order
3. replay `tail` in order

The visual result must be identical to replaying a single ordered stroke array
containing `base` followed by `tail`.

### Compatibility Strategy

The drawing-document core accepts two versions:

- `DrawingDocumentV1`: current schema with `strokes`
- `DrawingDocumentV2`: new schema with `base` and `tail`

Normalization rules are deterministic:

- V1 normalizes to V2 by mapping `strokes` into `base` and setting `tail` to an
  empty array.
- V2 remains V2.
- Canonical serialization always emits V2.

Canonical serialization means minified JSON with stable field ordering.

- Document fields serialize in this order: `version`, `kind`, `width`, `height`,
  `background`, then `base` and `tail`.
- Stroke fields serialize in this order: `color`, `size`, `points`.
- No whitespace or pretty-printing is allowed.

This ensures that a legacy V1 artwork can still be loaded anywhere in the
system, but any later save, fork, or publish can rewrite it as V2 without
needing a separate migration phase first.

## Lossless Compaction Definition

For this change, “lossless” means the compacted document must preserve the same
final rendered image under the product-owned replay semantics.

That definition intentionally focuses on the thing the product actually stores
and renders: ordered canvas drawing instructions. The compactor is allowed to
remove redundant instructions if the resulting V2 document produces the same
visible output.

Examples of allowed lossless reductions:

- duplicate consecutive points
- strictly collinear interior points whose removal does not change the rendered
  polyline
- strokes or stroke segments that are fully hidden by later strokes

Examples of forbidden canonical reductions:

- any approximate simplification using non-zero geometric tolerance
- any point removal that changes visible stroke coverage
- any split or merge that alters draw order semantics

The demo may expose approximate experimental controls for research, but those
results are informational only and must not become the canonical persistence
path.

## Compaction Pipeline

The production compactor runs on the normalized V2 view of the document.

### Phase 1: Exact Intra-Stroke Normalization

Before visibility analysis, each stroke is reduced only by exact operations.

- Remove consecutive duplicate points.
- Collapse runs of perfectly collinear points when the middle point lies on the
  exact same segment as its neighbors and removing it does not change path
  endpoints.
- Preserve single-point strokes as dots.

This phase must be mathematically exact. It exists to reduce obvious internal
redundancy without introducing approximation error.

Collinearity is defined with integer arithmetic only. For three consecutive
points `A`, `B`, and `C`, `B` is strictly collinear only when the 2D cross
product is exactly zero and `B` lies inside the closed segment `AC`. No epsilon
or floating-point tolerance is allowed in the canonical compactor.

This rule runs after consecutive duplicate removal. If `A = C`, or if `B`
matches either endpoint, the point is handled by duplicate normalization rather
than by the collinearity rule.

### Phase 2: Visibility Ownership Buffer

The core occlusion algorithm uses an in-memory ownership buffer sized to the
document canvas.

- Allocate an integer buffer of `width * height`.
- Replay normalized strokes from oldest to newest.
- Instead of storing color, stamp the current ordered stroke index into covered
  pixels.
- Coverage is defined by a shared product-owned raster helper rather than by
  browser canvas implementation details. A stroke footprint uses round caps,
  round joins, and radius `size / 2`. The helper enumerates candidate pixels
  inside the clipped canvas bounds `[0, width) × [0, height)` and marks a pixel
  as covered when the Euclidean distance from the pixel center to the nearest
  point on the stroke centerline is less than or equal to `size / 2 + sqrt(2) /
  2`. This conservative rule is the canonical replay oracle for compaction,
  ownership analysis, and pixel-perfect parity tests.

After this pass, each pixel identifies which stroke owns the visible topmost
coverage at that location.

This buffer is a computation tool only. It is not a persisted format.

### Phase 3: Visibility Classification

Revisit each normalized stroke and classify its sampled geometry against the
ownership buffer.

Sampling is explicit: each stroke segment is sampled at a maximum centerline
step of `0.5` pixels, and all original vertices are included as mandatory sample
positions. These samples only propose candidate hidden or visible runs; they do
not by themselves authorize removal.

- If all covered samples of a stroke belong to later strokes, the stroke is
  fully hidden and can be discarded.
- If only a prefix or suffix is hidden, trim the hidden portion in place and
  keep a single stroke object with the remaining visible points.
- If a hidden span exists in the middle, consider splitting into visible
  segments.

Visibility detection must be conservative. If the algorithm cannot prove that a
region is fully hidden, it stays.

For every sampled centerline point, removal is allowed only when the entire
brush footprint associated with that sample is owned by later strokes in the
buffer. Partial uncertainty must be treated as visible.

Any proposed trim or split must then be verified against the canonical raster
helper before it is committed. The retained fragment coverage must match the
original stroke coverage minus the regions already owned by later strokes. If
that equality check fails, the compactor keeps the original unsplit stroke.

### Phase 4: Split Heuristic

Splitting a stroke creates extra JSON structure. It should happen only when the
saved point payload justifies the additional object overhead.

The heuristic compares:

- estimated bytes saved by removing the hidden interior span
- estimated bytes added by materializing an extra stroke object

The split rule is explicit: materialize both candidates, serialize them with the
same compact JSON rules used by the document serializer, and split only when the
split candidate is strictly smaller in byte length than the unsplit candidate.
If the split candidate is equal or larger, the compactor keeps the original
stroke segment intact even if some interior points are hidden. This preserves
losslessness while avoiding negative storage trade-offs without relying on a
magic constant.

### Phase 5: Finalization

Compaction output is always a clean V2 snapshot.

- `base` becomes the compacted ordered stroke list
- `tail` becomes `[]`

This makes V2 stable for repeated rewrites. Storage does not grow without bound
because each rewrite recomputes a fresh compacted base instead of appending to
history forever.

## Shared Drawing Utilities

The drawing core should gain reusable format-aware helpers so the rest of the
system no longer depends on `document.strokes` directly.

Key utilities:

- parse a drawing document from V1 or V2 input
- normalize any supported input to V2
- iterate renderable strokes in canonical order
- clone V2 documents safely
- compact a V2 document losslessly
- serialize canonically as V2 JSON

Renderers such as canvas replay, SVG derivation, compression, and future publish
flows should depend on these shared helpers rather than branching per call site.

Compaction must be pure. The compactor never mutates the input object or any of
its stroke arrays. It always returns a distinct output document.

One of those shared helpers must be the raster coverage helper used by the
ownership buffer. Compaction correctness must not depend on duplicated coverage
logic spread across different modules.

## Demo Scope

`/demo/stroke-json` is the proving ground for V2.

The demo should:

- keep its working state as V2
- append newly drawn strokes to `tail`
- show metrics for the current V2 working document
- allow compaction and show the resulting document metrics
- compare original render vs compacted render and report any pixel diff
- optionally expose a non-canonical experimental RDP mode for research only

The demo exists to answer two practical questions before production adoption:

1. does lossless compaction materially reduce storage?
2. does the compactor preserve visible output under representative drawings?

## Future Product Adoption Rules

When the production app later adopts this work, the integration rules are
already defined.

- Read paths accept V1 and V2.
- Any publish, fork, avatar save, or other rewrite path normalizes the incoming
  document to V2.
- Before persistence, the write path compacts to V2 and stores the compacted
  result.
- A V1 artwork that is forked and republished becomes V2 on the next write.

This gives us backward compatibility at the read boundary without preserving V1
as a long-term canonical write format.

## Testing Strategy

The implementation should be test-first and cover the compactor as a pure core.

Required test areas:

- parser accepts valid V1 and valid V2
- canonical serialization rewrites V1-compatible content as V2
- render helpers produce identical output for equivalent V1 and V2 documents
- exact normalization removes duplicate and strictly collinear points only when
  replay is unchanged
- fully hidden strokes are removed
- hidden prefixes and suffixes are trimmed correctly
- interior hidden spans split only when the heuristic is favorable
- compaction end-to-end preserves final render parity on representative
  documents
- the shared raster coverage helper is validated against representative stroke
  fixtures so that any pixel visible in the helper-driven replay is also
  treated as covered by ownership analysis
- the demo can display pre- and post-compaction metrics and parity results

The raster helper validation should use small deterministic fixtures with an
independent brute-force oracle for point, segment, and canvas-edge cases rather
than only reusing the helper against itself.

Where visual parity is asserted, tests should compare rasterized output from the
same replay semantics rather than trusting structural equality alone. Canonical
lossless parity tests are pixel-perfect and must assert zero differing pixels in
the same runtime using the shared raster helper as the reference renderer.

Browser canvas replay should also have representative compatibility fixtures,
but those are secondary checks. The shared raster helper is the canonical oracle
for reproducible compaction tests.

## Risks And Constraints

- The ownership-buffer approach depends on replay parity between compaction-time
  coverage stamping and user-visible rendering semantics.
- A conservative classifier may leave some redundant bytes on the table, but
  that is preferable to breaking the lossless guarantee.
- Compaction cost grows with canvas area and stroke complexity, so the helper
  should stay pure and measurable before it is wired into synchronous publish
  flows.

## Rollout

This change ships in two stages.

1. Add universal parsing, V2 normalization, lossless compaction utilities, and
   demo validation.
2. After demo validation, wire production artwork and avatar writes to compacted
   V2 persistence while keeping universal read compatibility.