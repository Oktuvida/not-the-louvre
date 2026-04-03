## Why

Every gallery room except `your-studio` is capped at its initial 12 artworks with no way to load more. As the artwork catalog grows (targeting thousands), users see a tiny static slice. The `your-studio` room has infinite scroll via `VirtualizedArtworkGrid`, but its implementation has gaps — hardcoded 3-column layout breaks virtualization math on mobile/tablet, fixed row heights mismatch actual card heights, and there is no error feedback on failed loads. This change replaces the current room-specific rendering approaches with a shared, responsive, production-grade infinite scroll system that works across all gallery rooms — including the mystery reel, which needs to eventually surface every artwork in the database without unbounded memory growth.

## What Changes

- **Replace `VirtualizedArtworkGrid` with a responsive, robust implementation.** Fix the hardcoded `CARDS_PER_ROW = 3` and `ROW_HEIGHT = 360` assumptions. Use dynamic measurement so virtualization math stays correct at every breakpoint. Add error states, retry, and a loading indicator.
- **Add infinite scroll to hall-of-fame.** After the podium section (top 3), remaining artworks load progressively as the user scrolls. The podium is always visible and not virtualized.
- **Wire the mystery room for full catalog traversal.** The film reel's bounded pool grows as the user spins, fetching pages on demand. With eviction, it stays memory-bounded at ~36 items regardless of catalog size, while the cursor advances through every artwork in the database.
- **Introduce a shared `GalleryInfiniteScroll` component.** Encapsulates scroll-triggered loading, cursor management, deduplication, error handling, and the loading indicator. Individual rooms compose it with their own layout (grid, podium+grid, reel).

## Capabilities

### New Capabilities

- `gallery-infinite-scroll`: Shared infinite scroll infrastructure — responsive virtualization, scroll-triggered continuation, error handling, and loading states — available to all gallery rooms.

### Modified Capabilities

- `artwork-discovery`: The discovery contract is unchanged at the API level, but the frontend consumption changes. All rooms now actively paginate through discovery results rather than rendering only the first page.

## Impact

- **`VirtualizedArtworkGrid.svelte`**: Rewritten or replaced with responsive virtualization (dynamic column count, measured row heights).
- **`GalleryExplorationPage.svelte`**: Hall-of-fame section refactored to use infinite scroll below the podium. Mystery room pool management improved (the `$effect` clobbering bug is already fixed, but the pool + continuation flow needs to be robust).
- **`MysteryRoom.svelte`**: Low-water-mark continuation already wired; needs to work reliably with the bounded pool across full catalog traversal.
- **`HotWallRoom.svelte`**: Currently a placeholder ("Soon."). Not in scope for this change — it gains infinite scroll when its layout is implemented.
- **New component**: `GalleryInfiniteScroll.svelte` — shared scroll sentinel, loading spinner, error/retry UI.
- **No backend changes**: The API endpoint and `listArtworkDiscovery` already support cursor-based pagination for all sort types.
