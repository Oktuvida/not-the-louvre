# Gallery at Scale Design

## Goal

Make the gallery capable of handling thousands of artworks across all four
rooms without degrading browser performance, and make the Mystery Room idle
state cycle through every artwork in the database.

## Why

The gallery currently works at small scale (~50-100 artworks) but will break
down as the collection grows. Specific problems:

1. **No explicit image dimensions** — `<img>` tags lack `width`/`height`,
   causing layout shifts when images load and triggering unnecessary
   ResizeObserver recalculations in virtua.
2. **No rendering optimization for overscan** — items in virtua's buffer zone
   are fully painted even though they are not yet visible.
3. **Mystery Room sees only ~24 artworks** — the `BoundedPoolAccumulator`
   caps at 24 items and evicts older ones, so idle mode never reaches deep
   into the collection. Spin picks randomly from this small pool, not from the
   full database.
4. **GalleryExplorationPage is a 1088-line monolith** — all four rooms, three
   accumulators, realtime subscriptions, detail panel, transitions, and
   navigation are coupled in one file. One room's bug can break another room.
5. **Hot Wall is a placeholder** — receives props but renders "Soon."

## Current State Assessment

### Already implemented

- `WindowVirtualizer` from `virtua/svelte` virtualizes Hall of Fame and Your
  Studio grids (only ~30 DOM nodes regardless of total items).
- `ScrollSentinel` uses Intersection Observer with a 400-500px root margin
  for infinite scroll.
- `ArtworkAccumulator` manages append-only paginated loading with cursor-based
  pagination and deduplication.
- `BoundedPoolAccumulator` manages the Mystery Room pool with a capacity of 24
  and page size of 12.
- `FilmReel` uses a virtual-window approach for efficient circular scrolling
  (~9-13 DOM nodes regardless of pool size).
- `PolaroidCard` already has `loading="lazy"` and `decoding="async"` on
  artwork images.
- All artworks are 768×768 AVIF (square, uniform aspect ratio).
- Cursor-based pagination exists end-to-end (server load → API endpoint →
  client accumulator).

### Missing or weakly implemented

- Images lack `width="768" height="768"` attributes — causes CLS and
  layout thrashing in the virtualizer.
- No `content-visibility: auto` on gallery card containers — overscan items
  are fully rendered.
- Mystery Room idle only cycles through ~12-24 artworks at a time due to
  bounded pool and eviction.
- Mystery Room spin picks randomly from the local pool (~24 items), not the
  full database.
- All room logic, accumulators, and shared state live in
  `GalleryExplorationPage.svelte` (1088 lines).
- Realtime subscription logic (90+ lines) is inlined.
- Hot Wall renders a placeholder PostItNote.

## Scope

This change will:

- Decompose `GalleryExplorationPage.svelte` into per-room modules, each
  owning its own accumulator and rendering.
- Extract shared infrastructure into reusable components (`VirtualizedGrid`,
  `GalleryImage`) and a composable (`useRealtimeSubscription`).
- Add `width`/`height` attributes and `content-visibility: auto` with
  `contain-intrinsic-size` to gallery images and row containers.
- Replace the Mystery Room's `BoundedPoolAccumulator` with a new
  `StreamingAccumulator` that grows unbounded.
- Add a `GET /api/artworks/random` server endpoint for truly random artwork
  selection.
- Update `FilmReel` with a `spinToArtwork(artwork)` method and an
  `onIdleProgress` callback for prefetching.
- Make Hot Wall a functioning room using the same `VirtualizedGrid` +
  `ScrollSentinel` + `ArtworkAccumulator` pattern as the other grid rooms.

This change will not:

- Add image resizing or thumbnail generation (768×768 AVIF is already small
  and modern).
- Add BlurHash, ThumbHash, or dominant color placeholders (can be added as a
  follow-up without architectural changes).
- Change the database schema.
- Modify the drawing document format or publish pipeline.
- Change the visual design of existing rooms (PolaroidCard, FilmReel,
  podium layout remain as-is).

## Architecture

### Component Decomposition

The 1088-line `GalleryExplorationPage.svelte` is split into focused modules:

```
GalleryExplorationPage.svelte (~200 lines)
├── GalleryShell.svelte — header, nav, background, entry/exit transitions
├── ArtworkDetailPanel.svelte — overlay (already extracted)
├── useRealtimeSubscription.svelte.ts — Supabase realtime composable
│
├── rooms/
│   ├── HallOfFameRoom.svelte
│   │   owns ArtworkAccumulator (sort: "top")
│   │   renders Podium (top 3) + VirtualizedGrid + ScrollSentinel
│   │
│   ├── HotWallRoom.svelte
│   │   owns ArtworkAccumulator (sort: "hot")
│   │   renders VirtualizedGrid + ScrollSentinel
│   │
│   ├── MysteryRoom.svelte
│   │   owns StreamingAccumulator (sort: "recent", unbounded)
│   │   renders FilmReel + SpinButton
│   │
│   └── YourStudioRoom.svelte
│       owns ArtworkAccumulator (sort: "recent", authorId filter)
│       renders VirtualizedGrid + ScrollSentinel
│
├── components/ (shared)
│   ├── VirtualizedGrid.svelte — WindowVirtualizer + row layout + content-visibility
│   ├── GalleryImage.svelte — img wrapper with standard perf attributes
│   ├── ScrollSentinel.svelte — (already extracted, unchanged)
│   └── PolaroidCard.svelte — (already exists, minor img attribute updates)
```

### Design Principles

1. **Each room owns its state.** Accumulator is created inside the room
   component. When the room unmounts, state is cleaned up. No cross-room
   state leakage.

2. **Shared infrastructure, not shared state.** `VirtualizedGrid`,
   `GalleryImage`, `ScrollSentinel` are reusable components. Each room
   composes them independently.

3. **GalleryExplorationPage becomes a router.** ~200 lines: switches between
   room components based on `roomId`, handles shared layout (header,
   background, detail panel overlay).

4. **Testable in isolation.** Each room can be unit-tested with a mock
   accumulator. No need to set up all four rooms to test one.

## Image Loading Pipeline

### Current Flow (per image)

1. Virtua renders row → PolaroidCard mounts.
2. `<img src={artwork.imageUrl} loading="lazy" decoding="async">` — already
   has lazy + async.
3. No `width`/`height` attributes → browser cannot reserve space → CLS risk.
4. Image loads → ResizeObserver fires → virtua recalculates → layout thrash.
5. All overscan rows fully rendered (paint + layout) — wasted work.

### Proposed Flow (per image)

1. Virtua renders row → card wrapper has `content-visibility: auto` →
   overscan cards skip paint.
2. `contain-intrinsic-size: auto 380px` on card wrapper → stable height
   estimate for the virtualizer.
3. `<img width="768" height="768" loading="lazy" decoding="async">` →
   reserved space, zero CLS.
4. Card enters viewport → browser paints card → starts image fetch →
   just-in-time loading.
5. Image decoded off-thread (`decoding="async"`) → composited in without
   jank.

### Changes Required

**PolaroidCard.svelte:**
- Add `width="768"` and `height="768"` to the artwork `<img>` element.
- `loading="lazy"` and `decoding="async"` are already present.

**New: GalleryImage.svelte:**
- Thin wrapper around `<img>` that standardizes `width`, `height`, `loading`,
  `decoding`, `alt`, and `class` attributes.
- Single place for future enhancements (blur-up placeholder, srcset).

**New: VirtualizedGrid.svelte:**
- Wraps `WindowVirtualizer` + row rendering.
- Applies `content-visibility: auto` on each row wrapper div.
- Sets `contain-intrinsic-size: auto <calculated>` per row based on column
  count and the known 768×768 image dimensions.
- Accepts configurable column count (responsive breakpoints).
- Accepts a `renderCard` snippet for room-specific card rendering.

**FilmReel.svelte:**
- Add `width` and `height` attributes to reel frame images (based on
  `reelMetrics.frameSize`).

### Performance at 10K Items

| Metric | Current | Proposed |
|--------|---------|----------|
| DOM nodes | ~30 (virtua) | ~30 (unchanged) |
| Painted nodes | ~30 (all overscan) | ~10-15 (content-visibility skips overscan) |
| Layout shifts | Per image load | Zero (768×768 known) |
| Network (visible) | ~12 initial | ~8-12 (lazy defers rest) |
| Image memory | All decoded stay in cache | Browser manages decode cache |

## Mystery Room Overhaul

### Problem

The `BoundedPoolAccumulator` caps at 24 artworks. Idle mode cycles through
this pool, loads the next 12, evicts the oldest 12. The user never sees
artworks beyond a shallow window of the collection. Spin picks randomly from
at most 24 candidates.

### Solution: Two Changes

#### 1. StreamingAccumulator (replaces BoundedPoolAccumulator for Mystery)

A new accumulator that is append-only with no capacity limit and no eviction:

```typescript
interface StreamingAccumulator {
  readonly allArtworks: Artwork[];
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly progress: number; // 0-1, how far through the pool idle has reached
  loadMore(): Promise<void>;
  retry(): Promise<void>;
  reseed(artworks: Artwork[], pageInfo: PageInfo): void;
}
```

- Memory is safe: FilmReel only renders ~9-13 DOM nodes regardless of pool
  size. The accumulator stores `Artwork` objects (~200 bytes each). 10,000
  artworks × 200 bytes ≈ 2 MB — negligible.
- Prefetch strategy: When idle reaches ~80% through the loaded pool, the
  room triggers `loadMore()`. New items append seamlessly without pausing the
  animation.
- When all pages are exhausted (`hasMore = false`), idle loops from the start.

#### 2. GET /api/artworks/random (new endpoint)

Returns a single random non-hidden artwork from the entire database:

```
GET /api/artworks/random
Response: { artwork: ArtworkFeedCard }
```

Server implementation:

```sql
SELECT * FROM app.artworks
WHERE NOT is_hidden
ORDER BY random()
LIMIT 1
```

The endpoint respects NSFW filtering based on the viewer's content
preferences.

#### Updated Spin Flow

1. User clicks "Spin!"
2. Client fires `GET /api/artworks/random`.
3. Server returns a random artwork.
4. Client calls `filmReel.spinToArtwork(artwork)`.
5. FilmReel injects the artwork into the pool if not already present.
6. FilmReel runs the visual spin animation (3 full visual cycles → lands on
   target).
7. `onLand(artwork)` fires → detail panel opens.

#### FilmReel Changes

- New `spinToArtwork(artwork: Artwork)` method: injects the target into the
  pool at a random position if not present, calculates the target offset,
  and runs the existing spin animation to land on it.
- New `onIdleProgress(percent: number)` callback: fires as idle scrolls,
  allowing the parent to trigger prefetching at 80%.
- Existing `spin()` becomes internal (called by `spinToArtwork` after
  determining the target index).
- Add `width`/`height` to reel frame images.

## Per-Room Data Flow

### Hall of Fame

- Server load: `sort: "top"`, limit 12.
- Top 3 → Podium (special layout, always visible above the grid).
- Remaining → `ArtworkAccumulator` → rows → `VirtualizedGrid`.
- `ScrollSentinel` at bottom triggers `loadMore()`.
- Cursor pagination: 24 items per page after initial load.
- Column count: 1 mobile / 2 tablet / 4 desktop.

### Hot Wall

- Server load: `sort: "hot"`, limit 24.
- All → `ArtworkAccumulator` → rows → `VirtualizedGrid`.
- `ScrollSentinel` at bottom triggers `loadMore()`.
- Cursor pagination: 24 items per page.
- Column count: 1 mobile / 2 tablet / 3 desktop.

### Mystery Room

- Server load: `sort: "recent"`, limit 24.
- All → `StreamingAccumulator` (append-only, no cap).
- `FilmReel` idle scrolls through all loaded artworks.
- At ~80% through pool → prefetch next 24.
- When exhausted → loop from start.
- Spin: `GET /api/artworks/random` → `spinToArtwork()`.

### Your Studio

- Server load: `sort: "recent"`, `authorId: user.id`, limit 24.
- All → `ArtworkAccumulator` → rows → `VirtualizedGrid`.
- `ScrollSentinel` at bottom triggers `loadMore()`.
- Cursor pagination: 24 items per page.
- Column count: 1 mobile / 2 tablet / 3 desktop.
- Auth guard remains in server load (redirect to `/gallery` if not
  authenticated).

## Shared Infrastructure

| Component | Used By | Responsibility |
|-----------|---------|----------------|
| `VirtualizedGrid` | Fame, Hot Wall, Studio | WindowVirtualizer + row layout + content-visibility + responsive columns |
| `GalleryImage` | PolaroidCard, FilmReel | img wrapper: width/height 768, loading=lazy, decoding=async |
| `ScrollSentinel` | Fame, Hot Wall, Studio | Intersection Observer for infinite scroll (already exists) |
| `ArtworkAccumulator` | Fame, Hot Wall, Studio | Append-only paginated store with row grouping (already exists) |
| `StreamingAccumulator` | Mystery | Append-only flat list, progress tracking, no eviction (new) |
| `useRealtimeSubscription` | All rooms via parent | Supabase realtime for live vote/comment updates (extracted from monolith) |

## Testing Strategy

Each new component and change gets tests following the project's TDD
methodology:

- **StreamingAccumulator**: unit tests for append-only behavior, prefetch
  threshold, deduplication, reseed, and exhaustion looping.
- **VirtualizedGrid**: component tests verifying content-visibility CSS is
  applied, row rendering, responsive column count.
- **GalleryImage**: component tests verifying width/height/loading/decoding
  attributes.
- **GET /api/artworks/random**: server test verifying it returns a
  non-hidden artwork, respects NSFW filtering, and handles empty DB.
- **FilmReel.spinToArtwork**: component test verifying injection of unknown
  artwork, animation to target, and onLand callback.
- **Per-room components**: component tests verifying each room creates its
  accumulator, renders the correct grid/reel, and wires ScrollSentinel.
- **GalleryExplorationPage**: integration test verifying room switching
  renders the correct room component.

## Error Handling

- **Random endpoint fails**: Spin button shows an error toast. FilmReel
  stays in idle state. User can retry.
- **Prefetch fails during idle**: Idle continues looping through existing
  pool. Error is logged. Next cycle retries the fetch.
- **Accumulator page load fails**: ScrollSentinel shows the existing retry
  UI (already implemented).
- **Realtime subscription fails**: Existing `createRealtimeAttemptController`
  handles reconnection (already implemented).

## Future Enhancements (Out of Scope)

These can be added later without architectural changes:

- **Dominant color placeholder**: Add a `dominant_color` column to the
  artworks table, extract color at publish time, use as CSS background on
  `GalleryImage` while the real image loads.
- **BlurHash/ThumbHash**: Generate a hash at publish time for a blurred
  placeholder effect during load.
- **Image srcset**: Generate multiple sizes (300px, 600px, 768px) at publish
  time and use `srcset` with width descriptors. Currently unnecessary since
  768px source images are already small.
- **AVIF → WebP fallback**: Add `<picture>` with format negotiation. AVIF
  support is already universal in modern browsers.
