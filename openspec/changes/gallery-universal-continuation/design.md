## Context

The gallery has four rooms — `hall-of-fame` (top-ranked), `hot-wall` (trending), `mystery` (shuffled reel), and `your-studio` (author's own work). The backend's `listArtworkDiscovery()` already supports cursor-based pagination for every sort type (`recent`, `hot`, `top`), returning `pageInfo` with cursors and a `hasNextPage` flag. However, the server data-loading layer (`gallery-data.server.ts:98`) gates the continuation contract behind `scalableRoom = roomId === 'your-studio'`. Non-studio rooms receive `discovery.request: null`, so the frontend never learns it can fetch more.

On the frontend, `VirtualizedArtworkGrid` (used by `your-studio`) already handles append-and-virtualize continuation. The mystery room's `FilmReel` renders a virtual window of ~9-13 DOM slots regardless of data size, making it naturally efficient at rendering — but it has no way to request more artworks beyond the initial 12.

The prior `gallery-large-scale-loading` change explicitly deferred non-studio rooms. This change closes that gap.

## Goals / Non-Goals

**Goals:**

- Every gallery room exposes cursor metadata in its server response, enabling the frontend to request additional pages.
- Each room uses a retention policy appropriate to its UX: append-virtualize for scrollable rooms, bounded pool for the mystery reel.
- The mystery room continuously rotates through gallery content without accumulating unbounded data in memory.
- The change is purely additive to the existing continuation infrastructure — no new API endpoints, no schema changes.

**Non-Goals:**

- Infinite scroll for hall-of-fame or hot-wall is not required in this change. They gain the ability to load more, but aggressive infinite-scroll UX (auto-trigger on viewport proximity) can follow later.
- Prefetching or predictive loading strategies.
- Changing the backend discovery queries, sort algorithms, or ranking logic.
- Server-side rendering of paginated content beyond the first page.

## Decisions

### 1. Remove the scalableRoom gate, expose continuation for all rooms

**Choice**: Delete the `your-studio`-only guard in `gallery-data.server.ts`. Every room's response will include `discovery.request` with sort, limit, window, and cursor data.

**Rationale**: The backend already produces cursors for all sort types. The gate is a frontend data-loading concern, not a backend limitation. Removing it is a one-line change that unlocks continuation everywhere.

**Alternative considered**: Per-room opt-in flags on `GalleryRoomConfig`. Rejected — adds configuration surface for something that should be a universal capability. Rooms differ in *how* they consume pages, not *whether* they can.

### 2. Retention policy as a room-level concern, not a grid-level concern

**Choice**: Introduce a `retentionPolicy` concept at the room level that governs how `GalleryExplorationPage` manages the artwork buffer for each room. Three policies:

- `append` — keep all fetched pages (current `your-studio` behavior). Suitable for scrollable virtualized grids.
- `bounded-pool` — maintain a fixed-size candidate pool (e.g., 36 items / 3 pages). When a new page arrives, the oldest page is evicted. Suitable for the mystery reel where the user sees one artwork at a time and old items leave the viewport permanently.
- `append` for `hall-of-fame` and `hot-wall` — same as studio; they show a scrollable list with an editorial header section.

**Rationale**: The rendering component (grid vs. reel) shouldn't own the data lifecycle policy. The room knows its UX contract — the room should declare its retention model, and the parent page component should enforce it.

**Alternative considered**: Let each room component manage its own fetching and buffer. Rejected — duplicates the fetch/cursor/error handling that `GalleryExplorationPage.loadMoreArtworks` already encapsulates.

### 3. Mystery room: auto-advance triggers continuation

**Choice**: When the mystery reel's candidate pool drops below a low-water mark (e.g., fewer than 12 unseen items remaining), it requests the next page via the existing `loadMoreArtworks` mechanism. The bounded-pool policy evicts the oldest page to keep memory stable.

**Rationale**: The reel auto-advances every few seconds. With only 12 initial items, it exhausts content in under a minute. Proactive fetching when the pool is running low keeps the experience seamless without buffering all pages.

**Alternative considered**: Fetch on every page boundary (every 12 items viewed). Rejected — too many small fetches. Batch fetching with a low-water mark is simpler and reduces network chatter.

### 4. No new types on GalleryRoomConfig

**Choice**: Rather than adding `retentionPolicy` to the shared `GalleryRoomConfig` type (which is a presentation config), define the retention policy mapping as a simple lookup in `GalleryExplorationPage` keyed by room ID.

**Rationale**: `GalleryRoomConfig` currently holds display concerns (color, name, description). Retention policy is a data-management concern. A co-located lookup keeps the types clean and avoids touching the room definitions file for a non-visual concern.

## Risks / Trade-offs

- **[Risk] Ranked feeds (hot, top) may shift between pages** → Mitigation: The backend already uses `snapshotAt` in cursors for ranked feeds, ensuring consistency within a pagination session.
- **[Risk] Bounded pool eviction discards artworks the user might scroll back to in mystery room** → Mitigation: The mystery reel is forward-only (auto-advance, no scroll-back). Evicted items are genuinely unseen-again. If a "rewind" feature is added later, the retention policy can be revisited.
- **[Risk] `loadMoreArtworks` is currently only called from scroll-triggered virtualized grid** → Mitigation: The function itself is room-agnostic. The mystery room will call it via a timer/threshold check rather than a scroll observer, which is a minor integration point.
- **[Trade-off] All rooms now make the same server-side cursor data available, even if some rooms don't consume it yet** → Acceptable. The cursor metadata is small (a few string fields) and the backend already computes it.
