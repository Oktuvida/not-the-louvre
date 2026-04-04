## Why

The gallery works at small scale (~50-100 artworks) but will break down as the
collection grows to thousands. Images lack explicit dimensions causing layout
shifts, the Mystery Room only cycles through ~24 artworks instead of the full
database, and the 1088-line `GalleryExplorationPage.svelte` monolith couples
all four rooms making isolated changes risky. The Hot Wall room is still a
placeholder.

## What Changes

- Decompose `GalleryExplorationPage.svelte` into per-room modules, each owning
  its own accumulator and rendering logic.
- Extract shared infrastructure into reusable components (`VirtualizedGrid`,
  `GalleryImage`) and a composable (`useRealtimeSubscription`).
- Add `width`/`height` attributes and `content-visibility: auto` with
  `contain-intrinsic-size` to gallery images and row containers for zero CLS.
- Replace the Mystery Room's `BoundedPoolAccumulator` with an unbounded
  `StreamingAccumulator` so idle mode cycles through the entire collection.
- Add `GET /api/artworks/random` server endpoint for truly random spin
  selection from the full database.
- Update `FilmReel` with `spinToArtwork(artwork)` and `onIdleProgress` for
  prefetching.
- Make Hot Wall a functioning room with its specialized layout (lead artwork +
  supporting wall) per the prior hot-wall design spec.
- Update server load limits for Hot Wall and Mystery Room (12 -> 24).

## Capabilities

### New Capabilities

- `gallery-scaling-infrastructure`: Shared performance components
  (VirtualizedGrid, GalleryImage, content-visibility) and the
  StreamingAccumulator for unbounded artwork pools.
- `mystery-room-full-exploration`: Mystery Room overhaul — unbounded idle
  cycling through all artworks, server-side random endpoint for spin, and
  FilmReel prefetching integration.

### Modified Capabilities

- `artwork-discovery`: Adding `GET /api/artworks/random` endpoint alongside
  existing paginated discovery. Server load limits change for hot-wall and
  mystery rooms.

## Impact

- **Components**: `GalleryExplorationPage.svelte` (major refactor),
  `PolaroidCard.svelte` (minor — add width/height), `FilmReel.svelte`
  (new methods), `MysteryRoom.svelte` (new accumulator), `HotWallRoom.svelte`
  (new layout). New files: `HallOfFameRoom.svelte`, `YourStudioRoom.svelte`,
  `VirtualizedGrid.svelte`, `GalleryImage.svelte`,
  `useRealtimeSubscription.svelte.ts`, `StreamingAccumulator`.
- **Server**: `gallery-data.server.ts` (limit changes), new
  `api/artworks/random/+server.ts`.
- **Dependencies**: No new dependencies. Uses existing `virtua/svelte`.
- **Database**: No schema changes.
