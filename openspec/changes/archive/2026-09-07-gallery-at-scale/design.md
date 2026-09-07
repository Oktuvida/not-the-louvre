## Context

The gallery exploration feature currently handles ~50-100 artworks across four
rooms (Hall of Fame, Hot Wall, Mystery Room, Your Studio). All room logic,
three accumulators, realtime subscriptions, detail panel, transitions, and
navigation live in a single 1088-line `GalleryExplorationPage.svelte`. Images
lack explicit dimensions, causing layout shifts. The Mystery Room cycles through
only ~24 artworks via a bounded pool accumulator. The Hot Wall is a placeholder.

Full design spec: `docs/superpowers/specs/2026-04-03-gallery-at-scale-design.md`
Prior Hot Wall spec: `docs/superpowers/specs/2026-03-30-hot-wall-design.md`

## Goals / Non-Goals

**Goals:**

- Scale all four gallery rooms to handle thousands of artworks without
  degrading browser performance.
- Make Mystery Room idle cycle through every artwork in the database and
  spin select from the full collection.
- Decompose the monolith into per-room modules each owning their state.
- Make Hot Wall a functioning room with its specialized layout.
- Zero cumulative layout shift (CLS) from image loading.

**Non-Goals:**

- Image resizing, thumbnail generation, or format negotiation (768x768 AVIF
  is already small and modern).
- BlurHash/ThumbHash/dominant color placeholders (future enhancement).
- Database schema changes.
- Changing the drawing document format or publish pipeline.
- Changing the visual design of existing rooms.

## Decisions

### 1. Per-room module decomposition over incremental extraction

Each room becomes a self-contained Svelte component that owns its accumulator.
`GalleryExplorationPage` becomes a ~200-line router.

**Alternative considered**: Extract only shared utilities while keeping room
logic in the monolith. Rejected because room-level bugs would continue to
risk cross-contamination, and isolated testing would remain difficult.

### 2. StreamingAccumulator (unbounded) for Mystery Room

Replace `BoundedPoolAccumulator` (cap 24, evicts) with an append-only
accumulator that grows without limit. At ~200 bytes per artwork object and
only ~9-13 DOM nodes in FilmReel, 10K artworks = ~2MB memory — negligible.

**Alternative considered**: Increase bounded pool cap to 200+. Rejected
because it still limits collection coverage and adds eviction complexity.

### 3. Server-side random selection for spin

New `GET /api/artworks/random` endpoint using `ORDER BY random() LIMIT 1`.
Client calls this on spin and feeds the result to `filmReel.spinToArtwork()`.

**Alternative considered**: Client-side random selection from loaded pool.
Rejected because it limits spin to already-loaded artworks, defeating the
"any artwork in the database" goal.

### 4. content-visibility: auto on row wrappers (not individual cards)

Applied at the row level in `VirtualizedGrid` to skip paint for entire
overscan rows. Individual card-level would add complexity for minimal gain
since virtua already manages row-level virtualization.

### 5. Preserve Hot Wall specialized layout from prior spec

Hot Wall uses lead artwork + supporting wall layout per
`2026-03-30-hot-wall-design.md`, not a generic `VirtualizedGrid`. It still
benefits from `GalleryImage`, `ScrollSentinel`, `ArtworkAccumulator`, and
`content-visibility` infrastructure.

### 6. Accumulator seeding via reseed() from SSR data

Each room receives initial artworks and pageInfo from the SvelteKit server
load. The room creates its accumulator and calls `reseed()` in an `$effect`.
Subsequent pages fetched client-side via `GET /api/artworks` with cursor.

## Risks / Trade-offs

- **ORDER BY random() at scale** → At hundreds of thousands of rows this
  becomes slow. Mitigated: current scale is hundreds to low thousands; can
  swap to TABLESAMPLE or offset-based sampling later without API changes.

- **Unbounded memory in StreamingAccumulator** → At extreme scale (100K+
  artworks), memory could become meaningful (~20MB). Mitigated: current
  collection is far smaller; can add optional cap later if needed.

- **Decomposition risks breaking existing behavior** → Moving room logic
  out of the monolith could introduce regressions. Mitigated: TDD approach
  with per-room component tests; existing e2e tests catch integration breaks.

- **Hot Wall layout complexity** → Specialized layout (lead + risers +
  supporting grid) is more complex than generic VirtualizedGrid. Mitigated:
  the prior spec already defines the design; this change just wires it up
  with scaling infrastructure.
