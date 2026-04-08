## Why

Gallery rooms other than `your-studio` are capped at their initial page of artworks (12 items) because the server-side discovery request is only exposed for the `your-studio` room. As the artwork catalog grows, rooms like mystery, hot-wall, and hall-of-fame show an incomplete and static slice of content. The backend already supports cursor-based pagination for every sort type — the gap is entirely in the data-loading layer that withholds the continuation contract from non-studio rooms, and in the frontend rooms that lack a strategy for consuming additional pages.

## What Changes

- **Remove the `your-studio`-only gate on the continuation contract.** Every room's server response will include `discovery.request` with cursor metadata, making all rooms cursor-continuable.
- **Introduce room-specific retention policies.** Not every room should accumulate all fetched pages in memory:
  - `your-studio` keeps its current append-and-virtualize model.
  - `mystery` uses a bounded candidate pool — new pages replace old pages so memory stays capped regardless of how long the user watches.
  - `hall-of-fame` and `hot-wall` append below their editorial lead section with standard virtualized scrolling.
- **Wire continuation into mystery room's film reel.** The reel's auto-advance loop will request the next page when the candidate pool runs low, replacing exhausted pages to stay within bounds.

## Capabilities

### New Capabilities

- `gallery-room-continuation`: Universal cursor-based continuation contract for all gallery rooms, with room-specific retention policies governing how each room manages fetched pages in memory.

### Modified Capabilities

- `artwork-discovery`: The discovery contract's cursor metadata is already produced by the backend but was not exposed to all room consumers. This change requires the server loading layer to pass cursor metadata through for every room, not just `your-studio`.

## Impact

- **Server data loading**: `gallery-data.server.ts` — the `scalableRoom` guard is removed or generalized; all rooms receive `discovery.request`.
- **Gallery page component**: `GalleryExplorationPage.svelte` — `loadMoreArtworks` becomes available for all rooms; room-specific retention logic is introduced.
- **Mystery room**: `FilmReel.svelte` / `MysteryRoom.svelte` — gains a bounded candidate pool fed by continuation, replacing the current static-slice model.
- **Room model**: `rooms.ts` — room definitions may gain a retention policy field.
- **Existing tests**: Route loader tests, API endpoint tests, and room component tests need updates to verify continuation is available for all rooms.
