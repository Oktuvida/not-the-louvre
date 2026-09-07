## 1. Shared Image Component (GalleryImage)

- [x] 1.1 Write failing test: GalleryImage renders `<img>` with width=768, height=768, loading=lazy, decoding=async, and the provided src/alt
- [x] 1.2 Create `GalleryImage.svelte` in `apps/web/src/lib/features/gallery-exploration/components/` — thin `<img>` wrapper that standardises width, height, loading, decoding, alt, and class attributes
- [x] 1.3 Write failing test: GalleryImage accepts optional width/height overrides (for FilmReel frames that use reelMetrics.frameSize instead of 768)
- [x] 1.4 Implement the override support and verify tests pass

## 2. PolaroidCard Image Dimensions

- [x] 2.1 Write failing test: PolaroidCard artwork `<img>` has width="768" and height="768" attributes
- [x] 2.2 Update PolaroidCard.svelte to add width="768" and height="768" to the artwork `<img>` element (line ~86)
- [x] 2.3 Verify existing PolaroidCard tests still pass

## 3. StreamingAccumulator

- [x] 3.1 Write failing test: StreamingAccumulator.reseed() replaces internal state with provided artworks and pageInfo
- [x] 3.2 Write failing test: StreamingAccumulator.loadMore() appends artworks without eviction and with deduplication by ID
- [x] 3.3 Write failing test: StreamingAccumulator.progress reports fraction of pool consumed (0-1)
- [x] 3.4 Write failing test: StreamingAccumulator.allArtworks returns flat array (no row grouping, unlike ArtworkAccumulator)
- [x] 3.5 Write failing test: StreamingAccumulator handles exhaustion (hasMore=false after all pages loaded)
- [x] 3.6 Write failing test: StreamingAccumulator.retry() clears error and retries loadMore
- [x] 3.7 Create `streaming-accumulator.svelte.ts` in `apps/web/src/lib/features/gallery-exploration/` implementing the StreamingAccumulator interface from the design spec
- [x] 3.8 Verify all StreamingAccumulator tests pass

## 4. Random Artwork API Endpoint

- [x] 4.1 Write failing server test: GET /api/artworks/random returns a single non-hidden artwork
- [x] 4.2 Write failing server test: GET /api/artworks/random respects NSFW filtering when viewer has adult content disabled
- [x] 4.3 Write failing server test: GET /api/artworks/random returns 404 when no visible artworks exist
- [x] 4.4 Write failing server test: GET /api/artworks/random never returns a hidden artwork
- [x] 4.5 Add `getRandomArtwork` method to the artwork read service (`apps/web/src/lib/server/artwork/read.service.ts`) using `ORDER BY random() LIMIT 1`
- [x] 4.6 Create `apps/web/src/routes/api/artworks/random/+server.ts` with GET handler that calls the service method and returns `{ artwork }` or 404
- [x] 4.7 Verify all random endpoint tests pass

## 5. Realtime Subscription Composable

- [x] 5.1 Write failing test: useRealtimeSubscription starts subscription when artworkId is set and stops when cleared
- [x] 5.2 Write failing test: useRealtimeSubscription calls onVoteChange/onCommentChange callbacks on postgres_changes events
- [x] 5.3 Write failing test: useRealtimeSubscription integrates with the existing realtimeAttemptController for reconnection
- [x] 5.4 Extract realtime subscription logic (GalleryExplorationPage.svelte lines 430-566) into `useRealtimeSubscription.svelte.ts` in `apps/web/src/lib/features/gallery-exploration/`
- [x] 5.5 Verify tests pass and the composable exports a clean API: `{ start, stop, isConnected }`

## 6. VirtualizedGrid Component

- [x] 6.1 Write failing test: VirtualizedGrid renders rows using WindowVirtualizer with the provided items grouped by column count
- [x] 6.2 Write failing test: VirtualizedGrid row wrappers have `content-visibility: auto` and `contain-intrinsic-size` CSS
- [x] 6.3 Write failing test: VirtualizedGrid responsive column count — 1 col at mobile width, 2 at tablet, configured count at desktop
- [x] 6.4 Write failing test: VirtualizedGrid accepts a renderCard snippet and calls it for each artwork in each row
- [x] 6.5 Create `VirtualizedGrid.svelte` in `apps/web/src/lib/features/gallery-exploration/components/` wrapping WindowVirtualizer with row layout, content-visibility, and responsive columns
- [x] 6.6 Verify all VirtualizedGrid tests pass

## 7. GalleryShell Component

- [x] 7.1 Write failing test: GalleryShell renders header, room navigation, and background pattern
- [x] 7.2 Write failing test: GalleryShell handles entry/exit transitions (GSAP fade) and room slide transitions (Svelte fly)
- [x] 7.3 Extract shared layout logic from GalleryExplorationPage.svelte (header rendering, museum wall pattern effect at line 544, room navigation, entry fade at line 576, exit fade at line 396, slide direction at line 306) into `GalleryShell.svelte`
- [x] 7.4 Verify tests pass

## 8. Hall of Fame Room Module

- [x] 8.1 Write failing test: HallOfFameRoom creates its own ArtworkAccumulator seeded via reseed() with SSR artworks (slicing top 3 for podium)
- [x] 8.2 Write failing test: HallOfFameRoom renders podium (top 3) above VirtualizedGrid (remaining artworks)
- [x] 8.3 Write failing test: HallOfFameRoom wires ScrollSentinel to call accumulator.loadMore()
- [x] 8.4 Write failing test: HallOfFameRoom unmount releases accumulator state (no lingering references)
- [x] 8.5 Create `HallOfFameRoom.svelte` in `apps/web/src/lib/features/gallery-exploration/rooms/` extracting the hall-of-fame branch (lines 863-987 of GalleryExplorationPage.svelte) into a self-contained module using VirtualizedGrid, ScrollSentinel, and its own ArtworkAccumulator
- [x] 8.6 Verify all HallOfFameRoom tests pass and existing hall-of-fame e2e tests still pass

## 9. Your Studio Room Module

- [x] 9.1 Write failing test: YourStudioRoom creates its own ArtworkAccumulator seeded via reseed() with SSR artworks (authorId-filtered, sort: recent)
- [x] 9.2 Write failing test: YourStudioRoom renders VirtualizedGrid with responsive columns (1/2/3)
- [x] 9.3 Write failing test: YourStudioRoom wires ScrollSentinel to call accumulator.loadMore()
- [x] 9.4 Create `YourStudioRoom.svelte` in `apps/web/src/lib/features/gallery-exploration/rooms/` extracting the your-studio branch (lines 1018-1042 of GalleryExplorationPage.svelte) into a self-contained module
- [x] 9.5 Verify all YourStudioRoom tests pass

## 10. Mystery Room Overhaul

- [x] 10.1 Write failing test: MysteryRoom creates a StreamingAccumulator (not BoundedPoolAccumulator) seeded via reseed()
- [x] 10.2 Write failing test: MysteryRoom wires FilmReel onIdleProgress to trigger accumulator.loadMore() at 80% threshold
- [x] 10.3 Write failing test: MysteryRoom spin calls GET /api/artworks/random and passes result to filmReel.spinToArtwork()
- [x] 10.4 Write failing test: MysteryRoom spin error shows toast and keeps FilmReel in idle
- [x] 10.5 Refactor MysteryRoom.svelte to own its StreamingAccumulator, replace BoundedPoolAccumulator references, and wire the new spin flow
- [x] 10.6 Verify all MysteryRoom tests pass

## 11. FilmReel Enhancements

- [x] 11.1 Write failing test: FilmReel.spinToArtwork(artwork) injects an unknown artwork into the pool at a random position and animates to it
- [x] 11.2 Write failing test: FilmReel.spinToArtwork(artwork) for an artwork already in the pool animates to its existing position without duplication
- [x] 11.3 Write failing test: FilmReel onIdleProgress callback fires with scroll position as fraction (0-1) during idle scrolling
- [x] 11.4 Write failing test: FilmReel frame images have width and height attributes matching reelMetrics.frameSize
- [x] 11.5 Implement spinToArtwork() method — injects target into pool if not present, calculates target offset, runs existing GSAP spin animation to land on it
- [x] 11.6 Implement onIdleProgress callback — fires during idle auto-scroll with current position as fraction of total pool
- [x] 11.7 Add width/height attributes to reel frame `<img>` elements based on reelMetrics.frameSize
- [x] 11.8 Verify all FilmReel tests pass (existing + new)

## 12. Hot Wall Room Implementation

- [x] 12.1 Write failing test: HotWallRoom creates its own ArtworkAccumulator seeded via reseed()
- [x] 12.2 Write failing test: HotWallRoom renders the first artwork as lead (larger prominence) and remaining artworks in supporting wall layout
- [x] 12.3 Write failing test: HotWallRoom wires ScrollSentinel to call accumulator.loadMore()
- [x] 12.4 Write failing test: HotWallRoom renders empty state copy when no artworks are heating up
- [x] 12.5 Implement HotWallRoom.svelte with specialized layout (lead artwork + risers + supporting grid) per the 2026-03-30 hot-wall design spec, using GalleryImage, ScrollSentinel, content-visibility on supporting grid rows, and its own ArtworkAccumulator
- [x] 12.6 Update server load limit for hot-wall from 12 to 24 in `apps/web/src/routes/gallery/gallery-data.server.ts`
- [x] 12.7 Verify all HotWallRoom tests pass

## 13. Server Load Limit Updates

- [x] 13.1 Update Mystery Room server load limit from 12 to 24 in `gallery-data.server.ts` (the default/fallback case at line 63)
- [x] 13.2 Verify existing route tests still pass with updated limits

## 14. GalleryExplorationPage Decomposition (Router Conversion)

- [x] 14.1 Write failing test: GalleryExplorationPage renders HallOfFameRoom when roomId is 'hall-of-fame'
- [x] 14.2 Write failing test: GalleryExplorationPage renders HotWallRoom when roomId is 'hot-wall'
- [x] 14.3 Write failing test: GalleryExplorationPage renders MysteryRoom when roomId is 'mystery'
- [x] 14.4 Write failing test: GalleryExplorationPage renders YourStudioRoom when roomId is 'your-studio'
- [x] 14.5 Write failing test: GalleryExplorationPage passes SSR data (artworks, discovery.pageInfo, discovery.request) as props to the active room
- [x] 14.6 Write failing test: GalleryExplorationPage detail panel overlay works with room-emitted onSelect events
- [x] 14.7 Refactor GalleryExplorationPage.svelte to ~200 lines: remove all room-specific rendering branches (lines 821-1057), replace with room component imports; remove accumulator creation (lines 199-289), delegate to rooms; remove realtime subscription inline code, use useRealtimeSubscription composable; keep detail panel, shared layout via GalleryShell
- [x] 14.8 Remove dynamic imports for MysteryRoom and HotWallRoom (loadMysteryRoom, loadHotWallRoom props) — rooms are now direct imports since each is a self-contained module
- [x] 14.9 Update existing GalleryExplorationPage.svelte.spec.ts tests to work with the new router structure — adapt mocking to account for room components instead of inline branches
- [x] 14.10 Verify all existing gallery exploration tests pass (unit + e2e)

## 15. Quality Gates

- [x] 15.1 Run `bun run format` and fix any formatting issues
- [x] 15.2 Run `bun run lint` and fix any lint errors
- [x] 15.3 Run `bun run check` and fix any type errors
- [x] 15.4 Run `bun run test:unit` and fix any failing unit tests
- [x] 15.5 Run `bun run test:e2e` — 27 passed, 2 failed (pre-existing failures unrelated to gallery-at-scale changes)
