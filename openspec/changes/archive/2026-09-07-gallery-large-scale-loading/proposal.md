## Why

The current gallery can lazy-load route code and image fetches, but it still assumes a bounded result set rendered mostly at once. If the gallery must handle very large feeds, product performance now depends on limiting both server payload size and the number of gallery cards/images kept mounted in the browser at any given time.

## What Changes

- Add product-facing cursor pagination to gallery discovery so the gallery loads additional artworks incrementally instead of rendering an unbounded set in one response.
- Add virtualized gallery list/grid rendering so only the visible artwork cards and a small overscan window stay mounted while scrolling.
- Preserve current gallery room semantics and artwork detail-on-open behavior while changing how discovery results are fetched and rendered at scale.
- Add automated coverage that proves large gallery scrolling can continue without duplicate items, broken room context, or eager per-item detail fetches.

## Capabilities

### New Capabilities
- `gallery-virtualized-discovery`: Product gallery rendering that keeps only the visible discovery window mounted while users scroll through large result sets.

### Modified Capabilities
- `artwork-discovery`: Gallery-facing discovery consumption now depends on stable cursor continuation semantics that support long-running incremental loads in product browse flows.

## Impact

- Affected code: gallery route loads under `apps/web/src/routes/gallery/`, `GalleryExplorationPage.svelte`, gallery room/card rendering, and any new shared virtualization helpers.
- Affected systems: discovery route payload shape consumed by the gallery, browser scroll behavior, incremental room loading, and end-to-end browse performance for very large artwork sets.
- Dependencies: existing backend discovery cursors, current gallery room routing, and artwork detail APIs that remain on-demand.
