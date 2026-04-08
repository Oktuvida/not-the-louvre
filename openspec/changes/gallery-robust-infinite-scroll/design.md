## Context

The gallery has four rooms. Only `your-studio` has infinite scroll, implemented via `VirtualizedArtworkGrid` — a hand-rolled row-based virtualizer. The other rooms render a static first page (12 items) with no way to load more. The backend already supports cursor-based pagination for all sort types (`recent`, `hot`, `top`) via `listArtworkDiscovery`, and the `gallery-universal-continuation` change already exposed cursor metadata to every room. The gap is entirely on the frontend: nobody consumes the cursors except `your-studio`.

The current `VirtualizedArtworkGrid` has real problems:

- `CARDS_PER_ROW = 3` is hardcoded, but the CSS grid is responsive (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`). On mobile/tablet, the virtualization math is wrong — spacer heights overshoot or undershoot, causing content jumps and gaps.
- `ROW_HEIGHT = 360` is a fixed constant, but actual card heights vary by breakpoint (cards are square + metadata, so width dictates height) and by content (fork badge adds ~16px).
- Failed fetches are silently swallowed — no error state, no retry, the user just hits a dead end.
- Scroll tracking uses `window.scrollY` without offsetting for content above the grid (room nav, post-it notes, podium section), which can misalign the visible window.

The mystery room's bounded pool (`gallery-universal-continuation`) is wired but had an `$effect` clobbering bug — now fixed — and has never been tested against a large dataset end-to-end.

## Goals / Non-Goals

**Goals:**

- Every room with content (your-studio, hall-of-fame, mystery) loads progressively through the full artwork catalog as the user interacts.
- A single shared scroll infrastructure handles the load-more trigger, loading indicator, error/retry UI, and deduplication — each room composes it with its own layout.
- True DOM virtualization — only visible rows exist in the DOM, regardless of total artwork count. The system handles thousands of artworks without memory leaks or performance degradation.
- Responsive layout — column count adapts to viewport width at every breakpoint, and the virtualizer measures actual row heights dynamically.
- The mystery room can traverse thousands of artworks via its bounded pool without unbounded memory growth.
- The system handles edge cases gracefully: empty states, end-of-list, network errors, concurrent requests, and rapid scrolling.
- Professional UX polish: skeleton loading cards during fetches, smooth fade-in of new content, and end-of-list indicator.

**Non-Goals:**

- Hot wall infinite scroll — that room is still a placeholder ("Soon."). It will use the shared infrastructure when its layout is built, but this change doesn't build the layout.
- Prefetching or predictive loading (fetch page N+1 before the user reaches the bottom). Simple scroll-triggered loading is sufficient.
- Server-side rendering of paginated content beyond the first page.
- Changing backend sort algorithms, ranking logic, or page size limits.
- Masonry / staggered-column layout — cards are uniform per row.

## Decisions

### 1. Use `virtua` for DOM virtualization

**Choice**: Use the `virtua` library (npm: `virtua`, ~3KB gzipped) for true DOM virtualization in grid-based rooms. `virtua` provides a `VList` component with native Svelte 5 snippet syntax and zero-config dynamic size measurement via ResizeObserver.

**Rationale**: The hand-rolled `VirtualizedArtworkGrid` is the source of most bugs. Rather than fix it or build another custom solution, use a battle-tested library (442K weekly downloads, actively maintained, Svelte 5 native). `virtua` handles the hard parts — dynamic row height measurement, DOM recycling, scroll position management — out of the box. Its `VList` component with the Svelte 5 snippet API (`{#snippet children(item)}`) integrates cleanly with the existing codebase style.

**Alternative considered**: `@tanstack/svelte-virtual` — headless, more flexible, larger ecosystem (12M weekly downloads on core). Rejected because: (a) headless means we'd need to build all the container/positioning/scroll logic ourselves, which is the exact custom code we're trying to avoid; (b) ~260KB bundle vs virtua's 3KB; (c) virtua's component-based API is a better fit for Svelte's component model.

**Alternative considered**: CSS `content-visibility: auto` — zero JS, browser-native. Rejected because: (a) all DOM nodes still exist in memory, just skipping paint — at 1000+ artworks, that's 1000+ nodes consuming memory; (b) `contain-intrinsic-size` estimates cause scrollbar jitter when wrong; (c) not production-grade for a system targeting thousands of artworks.

### 2. Virtualize rows, not individual cards

**Choice**: The virtualizer manages **rows**, where each row is a flex/grid container holding 1–3 cards depending on viewport width. The column count is tracked reactively via a resize observer or media query, and `virtua`'s `VList` receives an array of row groups (each row = array of artworks for that row). Only ~10–15 row elements exist in the DOM at any time, regardless of total artwork count.

```
┌─────────────────────────────────────────────────┐
│  VList (virtua)                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Row 0: [Card, Card, Card]  ← in DOM    │    │
│  ├─────────────────────────────────────────┤    │
│  │ Row 1: [Card, Card, Card]  ← in DOM    │    │
│  ├─────────────────────────────────────────┤    │
│  │ Row 2: [Card, Card, Card]  ← in DOM    │    │
│  ├─────────────────────────────────────────┤    │
│  │ ...spacer...               ← no DOM    │    │
│  ├─────────────────────────────────────────┤    │
│  │ Row N: [Sentinel]          ← in DOM    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Only ~10-15 rows rendered at any time           │
│  ResizeObserver measures actual row height        │
│  Column count derived from viewport width        │
└─────────────────────────────────────────────────┘
```

**Rationale**: The gallery uses a uniform grid (all cards are aspect-square + metadata). Virtualizing rows instead of individual cards means: (a) row height is consistent within a row (all cards are the same width at a given breakpoint), (b) the CSS grid/flex within each row handles responsive column layout naturally, (c) virtua's dynamic measurement handles the slight height variance from fork badges automatically.

### 3. Intersection Observer sentinel for load-more triggering

**Choice**: Place a sentinel element after the last virtualized row. An `IntersectionObserver` on the sentinel triggers the next page fetch. This is a separate `ScrollSentinel.svelte` component, decoupled from the virtualizer.

**Rationale**: The sentinel pattern is the industry standard (Twitter, Reddit, Instagram). It works regardless of the virtualizer implementation — the sentinel just needs to be in the DOM when the user approaches the end. Decoupling it from virtualization means the mystery room (which doesn't use the grid virtualizer) can use the same sentinel concept for its low-water-mark check.

### 4. Shared artwork accumulator pattern

**Choice**: Create a `createArtworkAccumulator` utility (a Svelte 5 reactive class or function) that encapsulates:

- `allArtworks: Artwork[]` — the accumulated list (initial SSR artworks + fetched pages)
- `rows: Artwork[][]` — derived grid of artwork rows based on current column count
- `pageInfo` — current cursor state (`hasMore`, `nextCursor`)
- `isLoading` — whether a fetch is in progress
- `error` — last fetch error (null if none)
- `loadMore()` — fetch next page, deduplicate, append
- `retry()` — re-attempt last failed load
- `reset()` — clear appended artworks, restore to initial state

Each room instantiates this with its own fetch function and initial data. The sentinel calls `loadMore()`. The room reads `rows` for the virtualizer, `allArtworks` for non-virtualized sections (podium), and `isLoading`/`error` for UI states.

For mystery room, a `createBoundedPoolAccumulator` variant applies the eviction policy on top.

**Rationale**: This logic is currently scattered: `VirtualizedArtworkGrid` has its own `appendedArtworks` + `pageInfo` + `isLoadingMore`, `GalleryExplorationPage` has separate `mysteryPoolArtworks` + `mysteryPageInfo` + `isMysteryLoading`. A shared reactive accumulator eliminates the duplication and makes each room's continuation logic a one-liner to set up.

### 5. Hall-of-fame: podium is static, ranked grid is virtualized

**Choice**: The podium (top 3 with medals, frames, plaques) is always rendered outside the virtualizer — it's the editorial focal point. Below it, remaining ranked artworks render in a virtualized grid (via `virtua` `VList` + row groups) with the scroll sentinel at the bottom.

**Rationale**: The podium is 3 items and always visible — virtualizing it would add complexity for zero benefit. The ranked grid below is where scale matters. Since `virtua`'s `WindowVirtualizer` (or `VList` in a scrollable container) supports rendering arbitrary content before the virtualized list, the podium can sit above the virtualizer naturally.

### 6. Mystery room: bounded pool with full catalog traversal

**Choice**: Keep the existing bounded-pool approach (cap at 36 items, evict oldest page of 12 when a new page arrives). The low-water-mark check fires on spin. The idle reel cycles through whatever is in the pool. Over time, as the user spins, the pool rotates through the entire catalog.

Refinement from the previous design: **evict only when the reel is stopped (between spins), not during idle scrolling.** This eliminates the offset-adjustment complexity entirely. When a spin lands and triggers a page fetch, the fetch completes while the reel is stopped. The new artworks are added and old ones evicted while nothing is animating. When `resetToIdle` restarts the idle loop, it naturally picks up the new pool contents.

**Rationale**: The reel already virtualizes rendering (9-13 DOM nodes via circular indexing). The bounded pool virtualizes data. Together, both memory and DOM stay bounded regardless of catalog size. Evicting only when stopped is simpler and avoids all visual-jump edge cases.

### 7. Skeleton loading cards during fetches

**Choice**: When a page fetch is in progress, render a row of skeleton placeholder cards (pulsing gray rectangles matching the card shape) below the last real artwork. The skeletons maintain the grid shape and give the user a clear signal that content is loading.

**Rationale**: A spinner below a grid looks cheap. Skeleton cards are the standard pattern for content-loading UX (used by YouTube, Pinterest, LinkedIn). They prevent layout shift when real content arrives (the skeleton row is replaced by the real row at the same height). This is purely a UI concern — the sentinel triggers the fetch, the accumulator manages state, and the skeleton is a visual representation of `isLoading`.

### 8. Window-level scrolling with `WindowVirtualizer`

**Choice**: Use `virtua`'s `WindowVirtualizer` (or `VList` in window-scroll mode) instead of a fixed-height scrollable container. The entire page scrolls normally via `window`, and the virtualizer tracks the window scroll position to determine which rows to render.

**Rationale**: The gallery page already uses window-level scrolling — the room nav, post-it notes, and room content are all in the normal document flow. Putting the artwork grid in a fixed-height scroll container would create a "scroll within a scroll" UX, which is disorienting on mobile. Window-level virtualization means the page feels like a normal web page, the browser's native scroll momentum works correctly, and the address bar behavior on mobile is standard.

## Risks / Trade-offs

- **[Risk] `virtua` is a dependency** — Adding a third-party library for virtualization means trusting its maintenance. → Mitigation: `virtua` is actively maintained (last commit days ago), has 442K weekly downloads, and is only ~3KB gzipped. The library's API surface is small (2-3 components). If it were abandoned, replacing it with a hand-rolled solution or TanStack Virtual would be contained to the virtualizer wrapper — the accumulator, sentinel, and room logic are all framework-agnostic.

- **[Risk] Row-based virtualization requires knowing the column count** — The virtualizer receives row groups, so the column count must be known before grouping artworks into rows. If the column count changes (viewport resize), the row groups need to be recomputed. → Mitigation: Track column count reactively via a resize observer or `$derived` from viewport width. The accumulator's `rows` derivation recomputes when column count changes. This is a cheap operation (slicing an array into chunks).

- **[Risk] Race condition on rapid scrolling** — User scrolls fast, sentinel fires multiple times before the first fetch completes. → Mitigation: The accumulator's `loadMore()` guards on `isLoading` — concurrent calls are no-ops. The sentinel re-fires after the fetch completes if it's still in view, triggering the next page naturally.

- **[Risk] Anchor scrolling during mystery pool eviction** — When the bounded pool evicts items, `artworks.length` shrinks, which could change the modulo mapping in FilmReel. → Mitigation: Evict only when the reel is stopped (between spins), so no animation is in progress and offset consistency doesn't matter. The next `startIdle()` call recalculates from the current offset.

- **[Trade-off] Window-level scroll means the virtualizer must account for non-virtualized content above it** — The podium, room nav, post-it notes all consume vertical space above the virtualized grid. → `WindowVirtualizer` handles this natively by tracking element positions relative to the window viewport, not an internal scroll container.
