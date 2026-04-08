## 1. Install virtua and scaffold shared utilities

- [x] 1.1 Install `virtua` in `apps/web`: `bun add virtua`
- [x] 1.2 Verify virtua imports resolve: create a throwaway test that imports `VList` from `virtua/svelte` (or the correct Svelte 5 entry point) and confirm the build doesn't break. Remove the throwaway test after confirming.

## 2. Scroll sentinel component

- [x] 2.1 Write failing test for `ScrollSentinel.svelte`: renders a sentinel element, calls `onTrigger` when sentinel enters viewport via IntersectionObserver, does NOT call `onTrigger` when `disabled` is true
- [x] 2.2 Implement `ScrollSentinel.svelte` — thin component: renders a sentinel div observed by IntersectionObserver, accepts `onTrigger`, `disabled`, `rootMargin` props. The sentinel is invisible (1px height) and positioned after the grid content.
- [x] 2.3 Write failing test for `ScrollSentinel` loading state: when `isLoading` is true, renders a row of skeleton placeholder cards matching the grid layout
- [x] 2.4 Implement skeleton loading row in `ScrollSentinel` — pulsing gray rectangles matching artwork card aspect ratio (`aspect-square` image area + metadata bar), rendered in a responsive grid row (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for your-studio, `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for hall-of-fame). Accept a `columns` prop or use the same responsive grid classes.
- [x] 2.5 Write failing test for `ScrollSentinel` error/retry: when `error` is set, renders error message and retry button; clicking retry calls `onRetry`
- [x] 2.6 Implement error/retry UI in `ScrollSentinel` — error message + retry button below the grid
- [x] 2.7 Write failing test for `ScrollSentinel` end-of-list: when `hasMore` is false and `isLoading` is false and `error` is null, renders an end-of-list indicator
- [x] 2.8 Implement end-of-list indicator in `ScrollSentinel`

## 3. Artwork accumulator

- [x] 3.1 Write failing test for `createArtworkAccumulator`: initializing with artworks and pageInfo, calling `loadMore()` appends fetched artworks (deduplicated by ID), updates pageInfo and cursor state
- [x] 3.2 Implement `createArtworkAccumulator` as a Svelte 5 reactive class — exposes `allArtworks`, `rows` (derived from column count), `pageInfo`, `isLoading`, `error`, `hasMore`, `loadMore()`, `retry()`, `reset()`. Deduplicates by artwork ID on append. `loadMore()` is a no-op when `isLoading` or `!hasMore`.
- [x] 3.3 Write failing test: `loadMore()` is a no-op when `isLoading` is true or `hasMore` is false
- [x] 3.4 Write failing test: when fetch fails, `error` is set and `retry()` re-attempts the same cursor
- [x] 3.5 Implement error handling and retry in the accumulator
- [x] 3.6 Write failing test for `rows` derivation: artworks are chunked into rows of N based on a reactive `columnCount` parameter; when `columnCount` changes, rows recompute
- [x] 3.7 Implement `rows` derivation in the accumulator

## 4. Bounded pool accumulator (mystery room)

- [x] 4.1 Write failing test for `createBoundedPoolAccumulator`: same as accumulator but evicts oldest page when pool exceeds capacity (36 items, evict in chunks of 12)
- [x] 4.2 Implement `createBoundedPoolAccumulator` — wraps or extends the base accumulator with bounded-pool eviction logic. Eviction happens on `loadMore()` completion. Exposes same interface as the base accumulator plus pool-specific state.
- [x] 4.3 Write failing test: after full catalog traversal (`hasMore: false`), no more fetches are attempted and the pool retains its current contents for cycling
- [x] 4.4 Implement the full-catalog-traversal end state

## 5. Your-studio migration to virtua

- [x] 5.1 Write failing test: your-studio room renders artworks in a virtualized grid using `virtua`'s `WindowVirtualizer` (or `VList`), with only rows near the viewport existing in the DOM
- [x] 5.2 Replace `VirtualizedArtworkGrid` usage in `GalleryExplorationPage.svelte` your-studio branch with: `createArtworkAccumulator` for state + `virtua` `WindowVirtualizer` for DOM virtualization + `ScrollSentinel` for load-more triggering. Render row groups where each row is a responsive grid of 1-3 cards.
- [x] 5.3 Track column count reactively — use a resize observer or `$derived` from a container ref to determine current column count (1, 2, or 3 based on breakpoints matching `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- [x] 5.4 Write test: scrolling to sentinel triggers `loadMore`, new artworks appear in the grid
- [x] 5.5 Write test: fetch error shows error message with retry button, retry re-fetches
- [x] 5.6 Verify your-studio works at mobile (1-col), tablet (2-col), and desktop (3-col) breakpoints — no content jumps or spacer misalignment

## 6. Hall-of-fame infinite scroll

- [x] 6.1 Write failing test: hall-of-fame renders podium (top 3) statically and a ranked grid below with virtualized rows and a scroll sentinel at the bottom
- [x] 6.2 Refactor hall-of-fame rendering in `GalleryExplorationPage.svelte` to use `createArtworkAccumulator` for the artwork list, `virtua` `WindowVirtualizer` for the ranked grid (4th artwork onward), and `ScrollSentinel` below the grid. Podium (top 3) remains outside the virtualizer, always rendered.
- [x] 6.3 Write test: scrolling to sentinel loads next page of top-ranked artworks, which append below existing cards
- [x] 6.4 Write test: podium section (top 3) is always rendered and not affected by scroll position or page loading
- [x] 6.5 Write test: when `hasMore` is false, end-of-list indicator is shown and no fetch is attempted

## 7. Mystery room robustness

- [x] 7.1 Write failing test: mystery room uses `createBoundedPoolAccumulator`, pool grows on fetch and evicts when exceeding capacity
- [x] 7.2 Replace manual `mysteryPoolArtworks`/`mysteryPageInfo`/`isMysteryLoading`/`mysteryPoolInitialized`/`mysteryHasMore`/`handleMysteryRequestMore` state in `GalleryExplorationPage.svelte` with `createBoundedPoolAccumulator`
- [x] 7.3 Write test: eviction occurs only when the reel is stopped (between spins), not during animation
- [x] 7.4 Implement deferred eviction — the bounded pool accumulator buffers pending evictions and applies them only when a `flush()` or `applyPendingEviction()` method is called, which `MysteryRoom` calls in `handleLand` (after spin completes, before `resetToIdle`)
- [x] 7.5 Write test: after full catalog traversal (`hasMore: false`), reel continues cycling through remaining pool without requesting more pages
- [x] 7.6 Manual smoke test with seed data (50 artworks, pool cap 36): spin through all pages, verify reel shows artworks from all pages and memory stays bounded

## 8. Cleanup

- [x] 8.1 Remove or deprecate `VirtualizedArtworkGrid.svelte` — fully replaced by virtua + accumulator + sentinel pattern
- [x] 8.2 Remove the manual mystery pool state (`mysteryPoolArtworks`, `mysteryPageInfo`, `isMysteryLoading`, `mysteryPoolInitialized`, `mysteryHasMore`, `handleMysteryRequestMore`) from `GalleryExplorationPage.svelte` — replaced by the bounded pool accumulator
- [x] 8.3 Remove `retentionPolicyForRoom` and `BOUNDED_POOL_CAPACITY`/`BOUNDED_POOL_PAGE_SIZE` constants from `GalleryExplorationPage.svelte` — moved into the bounded pool accumulator
- [x] 8.4 Update any imports or references to `VirtualizedArtworkGrid` elsewhere in the codebase

## 9. Quality gates

- [x] 9.1 Run `bun run format && bun run lint && bun run check` — all pass
- [x] 9.2 Run `bun run test:unit` — all tests pass, no regressions
- [ ] 9.3 Run `bun run test:e2e` — all tests pass
- [ ] 9.4 Manual smoke test: your-studio infinite scroll at mobile, tablet, and desktop — smooth scrolling, no content jumps, skeleton cards visible during fetches
- [ ] 9.5 Manual smoke test: hall-of-fame with 50+ artworks — podium always visible, ranked grid loads progressively, end-of-list shown when all loaded
- [ ] 9.6 Manual smoke test: mystery room with 50+ artworks — spin through all pages, verify reel shows diverse artworks, no visual jumps during pool eviction
