## 1. Shared Image Component (GalleryImage)

- [ ] 1.1 Write failing test: GalleryImage renders `<img>` with width=768, height=768, loading=lazy, decoding=async, and the provided src/alt
- [ ] 1.2 Create `GalleryImage.svelte` in `apps/web/src/lib/features/gallery-exploration/components/` — thin `<img>` wrapper that standardises width, height, loading, decoding, alt, and class attributes
- [ ] 1.3 Write failing test: GalleryImage accepts optional width/height overrides (for FilmReel frames that use reelMetrics.frameSize instead of 768)
- [ ] 1.4 Implement the override support and verify tests pass

## 2. PolaroidCard Image Dimensions

- [ ] 2.1 Write failing test: PolaroidCard artwork `<img>` has width="768" and height="768" attributes
- [ ] 2.2 Update PolaroidCard.svelte to add width="768" and height="768" to the artwork `<img>` element (line ~86)
- [ ] 2.3 Verify existing PolaroidCard tests still pass

## 3. StreamingAccumulator

- [ ] 3.1 Write failing test: StreamingAccumulator.reseed() replaces internal state with provided artworks and pageInfo
- [ ] 3.2 Write failing test: StreamingAccumulator.loadMore() appends artworks without eviction and with deduplication by ID
- [ ] 3.3 Write failing test: StreamingAccumulator.progress reports fraction of pool consumed (0-1)
- [ ] 3.4 Write failing test: StreamingAccumulator.allArtworks returns flat array (no row grouping, unlike ArtworkAccumulator)
- [ ] 3.5 Write failing test: StreamingAccumulator handles exhaustion (hasMore=false after all pages loaded)
- [ ] 3.6 Write failing test: StreamingAccumulator.retry() clears error and retries loadMore
- [ ] 3.7 Create `streaming-accumulator.svelte.ts` in `apps/web/src/lib/features/gallery-exploration/` implementing the StreamingAccumulator interface from the design spec
- [ ] 3.8 Verify all StreamingAccumulator tests pass

## 4. Random Artwork API Endpoint

- [ ] 4.1 Write failing server test: GET /api/artworks/random returns a single non-hidden artwork
- [ ] 4.2 Write failing server test: GET /api/artworks/random respects NSFW filtering when viewer has adult content disabled
- [ ] 4.3 Write failing server test: GET /api/artworks/random returns 404 when no visible artworks exist
- [ ] 4.4 Write failing server test: GET /api/artworks/random never returns a hidden artwork
- [ ] 4.5 Add `getRandomArtwork` method to the artwork read service (`apps/web/src/lib/server/artwork/read.service.ts`) using `ORDER BY random() LIMIT 1`
- [ ] 4.6 Create `apps/web/src/routes/api/artworks/random/+server.ts` with GET handler that calls the service method and returns `{ artwork }` or 404
- [ ] 4.7 Verify all random endpoint tests pass

## 5. Realtime Subscription Composable

- [ ] 5.1 Write failing test: useRealtimeSubscription starts subscription when artworkId is set and stops when cleared
- [ ] 5.2 Write failing test: useRealtimeSubscription calls onVoteChange/onCommentChange callbacks on postgres_changes events
- [ ] 5.3 Write failing test: useRealtimeSubscription integrates with the existing realtimeAttemptController for reconnection
- [ ] 5.4 Extract realtime subscription logic (GalleryExplorationPage.svelte lines 430-566) into `useRealtimeSubscription.svelte.ts` in `apps/web/src/lib/features/gallery-exploration/`
- [ ] 5.5 Verify tests pass and the composable exports a clean API: `{ start, stop, isConnected }`

## 6. VirtualizedGrid Component

- [ ] 6.1 Write failing test: VirtualizedGrid renders rows using WindowVirtualizer with the provided items grouped by column count
- [ ] 6.2 Write failing test: VirtualizedGrid row wrappers have `content-visibility: auto` and `contain-intrinsic-size` CSS
- [ ] 6.3 Write failing test: VirtualizedGrid responsive column count — 1 col at mobile width, 2 at tablet, configured count at desktop
- [ ] 6.4 Write failing test: VirtualizedGrid accepts a renderCard snippet and calls it for each artwork in each row
- [ ] 6.5 Create `VirtualizedGrid.svelte` in `apps/web/src/lib/features/gallery-exploration/components/` wrapping WindowVirtualizer with row layout, content-visibility, and responsive columns
- [ ] 6.6 Verify all VirtualizedGrid tests pass

## 7. GalleryShell Component

- [ ] 7.1 Write failing test: GalleryShell renders header, room navigation, and background pattern
- [ ] 7.2 Write failing test: GalleryShell handles entry/exit transitions (GSAP fade) and room slide transitions (Svelte fly)
- [ ] 7.3 Extract shared layout logic from GalleryExplorationPage.svelte (header rendering, museum wall pattern effect at line 544, room navigation, entry fade at line 576, exit fade at line 396, slide direction at line 306) into `GalleryShell.svelte`
- [ ] 7.4 Verify tests pass

## 8. Hall of Fame Room Module

- [ ] 8.1 Write failing test: HallOfFameRoom creates its own ArtworkAccumulator seeded via reseed() with SSR artworks (slicing top 3 for podium)
- [ ] 8.2 Write failing test: HallOfFameRoom renders podium (top 3) above VirtualizedGrid (remaining artworks)
- [ ] 8.3 Write failing test: HallOfFameRoom wires ScrollSentinel to call accumulator.loadMore()
- [ ] 8.4 Write failing test: HallOfFameRoom unmount releases accumulator state (no lingering references)
- [ ] 8.5 Create `HallOfFameRoom.svelte` in `apps/web/src/lib/features/gallery-exploration/rooms/` extracting the hall-of-fame branch (lines 863-987 of GalleryExplorationPage.svelte) into a self-contained module using VirtualizedGrid, ScrollSentinel, and its own ArtworkAccumulator
- [ ] 8.6 Verify all HallOfFameRoom tests pass and existing hall-of-fame e2e tests still pass

## 9. Your Studio Room Module

- [ ] 9.1 Write failing test: YourStudioRoom creates its own ArtworkAccumulator seeded via reseed() with SSR artworks (authorId-filtered, sort: recent)
- [ ] 9.2 Write failing test: YourStudioRoom renders VirtualizedGrid with responsive columns (1/2/3)
- [ ] 9.3 Write failing test: YourStudioRoom wires ScrollSentinel to call accumulator.loadMore()
- [ ] 9.4 Create `YourStudioRoom.svelte` in `apps/web/src/lib/features/gallery-exploration/rooms/` extracting the your-studio branch (lines 1018-1042 of GalleryExplorationPage.svelte) into a self-contained module
- [ ] 9.5 Verify all YourStudioRoom tests pass

## 10. Mystery Room Overhaul

- [ ] 10.1 Write failing test: MysteryRoom creates a StreamingAccumulator (not BoundedPoolAccumulator) seeded via reseed()
- [ ] 10.2 Write failing test: MysteryRoom wires FilmReel onIdleProgress to trigger accumulator.loadMore() at 80% threshold
- [ ] 10.3 Write failing test: MysteryRoom spin calls GET /api/artworks/random and passes result to filmReel.spinToArtwork()
- [ ] 10.4 Write failing test: MysteryRoom spin error shows toast and keeps FilmReel in idle
- [ ] 10.5 Refactor MysteryRoom.svelte to own its StreamingAccumulator, replace BoundedPoolAccumulator references, and wire the new spin flow
- [ ] 10.6 Verify all MysteryRoom tests pass

## 11. FilmReel Enhancements

- [ ] 11.1 Write failing test: FilmReel.spinToArtwork(artwork) injects an unknown artwork into the pool at a random position and animates to it
- [ ] 11.2 Write failing test: FilmReel.spinToArtwork(artwork) for an artwork already in the pool animates to its existing position without duplication
- [ ] 11.3 Write failing test: FilmReel onIdleProgress callback fires with scroll position as fraction (0-1) during idle scrolling
- [ ] 11.4 Write failing test: FilmReel frame images have width and height attributes matching reelMetrics.frameSize
- [ ] 11.5 Implement spinToArtwork() method — injects target into pool if not present, calculates target offset, runs existing GSAP spin animation to land on it
- [ ] 11.6 Implement onIdleProgress callback — fires during idle auto-scroll with current position as fraction of total pool
- [ ] 11.7 Add width/height attributes to reel frame `<img>` elements based on reelMetrics.frameSize
- [ ] 11.8 Verify all FilmReel tests pass (existing + new)

## 12. Hot Wall Room Implementation

- [ ] 12.1 Write failing test: HotWallRoom creates its own ArtworkAccumulator seeded via reseed()
- [ ] 12.2 Write failing test: HotWallRoom renders the first artwork as lead (larger prominence) and remaining artworks in supporting wall layout
- [ ] 12.3 Write failing test: HotWallRoom wires ScrollSentinel to call accumulator.loadMore()
- [ ] 12.4 Write failing test: HotWallRoom renders empty state copy when no artworks are heating up
- [ ] 12.5 Implement HotWallRoom.svelte with specialized layout (lead artwork + risers + supporting grid) per the 2026-03-30 hot-wall design spec, using GalleryImage, ScrollSentinel, content-visibility on supporting grid rows, and its own ArtworkAccumulator
- [ ] 12.6 Update server load limit for hot-wall from 12 to 24 in `apps/web/src/routes/gallery/gallery-data.server.ts`
- [ ] 12.7 Verify all HotWallRoom tests pass

## 13. Server Load Limit Updates

- [ ] 13.1 Update Mystery Room server load limit from 12 to 24 in `gallery-data.server.ts` (the default/fallback case at line 63)
- [ ] 13.2 Verify existing route tests still pass with updated limits

## 14. GalleryExplorationPage Decomposition (Router Conversion)

- [ ] 14.1 Write failing test: GalleryExplorationPage renders HallOfFameRoom when roomId is 'hall-of-fame'
- [ ] 14.2 Write failing test: GalleryExplorationPage renders HotWallRoom when roomId is 'hot-wall'
- [ ] 14.3 Write failing test: GalleryExplorationPage renders MysteryRoom when roomId is 'mystery'
- [ ] 14.4 Write failing test: GalleryExplorationPage renders YourStudioRoom when roomId is 'your-studio'
- [ ] 14.5 Write failing test: GalleryExplorationPage passes SSR data (artworks, discovery.pageInfo, discovery.request) as props to the active room
- [ ] 14.6 Write failing test: GalleryExplorationPage detail panel overlay works with room-emitted onSelect events
- [ ] 14.7 Refactor GalleryExplorationPage.svelte to ~200 lines: remove all room-specific rendering branches (lines 821-1057), replace with room component imports; remove accumulator creation (lines 199-289), delegate to rooms; remove realtime subscription inline code, use useRealtimeSubscription composable; keep detail panel, shared layout via GalleryShell
- [ ] 14.8 Remove dynamic imports for MysteryRoom and HotWallRoom (loadMysteryRoom, loadHotWallRoom props) — rooms are now direct imports since each is a self-contained module
- [ ] 14.9 Update existing GalleryExplorationPage.svelte.spec.ts tests to work with the new router structure — adapt mocking to account for room components instead of inline branches
- [ ] 14.10 Verify all existing gallery exploration tests pass (unit + e2e)

## 15. Quality Gates

- [ ] 15.1 Run `bun run format` and fix any formatting issues
- [ ] 15.2 Run `bun run lint` and fix any lint errors
- [ ] 15.3 Run `bun run check` and fix any type errors
- [ ] 15.4 Run `bun run test:unit` and fix any failing unit tests
- [ ] 15.5 Run `bun run test:e2e` and fix any failing e2e tests
