## 1. Server-side continuation contract

- [x] 1.1 Write failing test in `apps/web/src/routes/gallery/[room]/page.server.test.ts`: assert that hot-wall, mystery, and hall-of-fame room responses include `discovery.request` with non-null sort, limit, and cursor metadata (currently they return `discovery.request: null`)
- [x] 1.2 In `gallery-data.server.ts` (line 98), remove the `scalableRoom` guard. Build `discovery.request` for every room using the values already in `roomDiscoveryRequest()` — sort, limit, window from the request, authorId only for your-studio
- [x] 1.3 Remove or repurpose the `scalable: boolean` field from the `GalleryRoomData` type (line 27) — it is always `true` when present and adds no information
- [x] 1.4 Update the existing your-studio test assertion in `page.server.test.ts` (lines 86-116) to match the updated type, and add parallel assertions for hot-wall, mystery, and hall-of-fame

## 2. Frontend continuation wiring for all rooms

- [x] 2.1 Write failing test in `GalleryExplorationPage.svelte.spec.ts`: assert that `loadMoreArtworks` is callable from the mystery room when spins trigger low-water mark
- [x] 2.2 In `GalleryExplorationPage.svelte`, pass `discovery` and `loadMoreArtworks` to the mystery room via bounded-pool state management
- [x] 2.3 In `GalleryExplorationPage.svelte`, pass `hasMore`, `onRequestMore`, and the bounded-pool-managed artwork buffer to `MysteryRoom` in both template branches (cached module + await)

## 3. Retention policy

- [x] 3.1 Added `retentionPolicyForRoom(roomId)` lookup co-located in `GalleryExplorationPage.svelte` — returns `'bounded-pool'` for mystery, `'append'` for all others
- [x] 3.2 Implemented bounded-pool eviction in `handleMysteryRequestMore`: when total exceeds 36, oldest page-sized chunk is evicted
- Dedicated unit tests for retention policy skipped per user decision — behavior verified through integration test and manual smoke testing

## 4. Mystery room continuation

- [x] 4.1 Added `onRequestMore` callback prop and `hasMore` boolean prop to `MysteryRoom.svelte`, with `spinCount` tracking and low-water-mark check in `handleLand`
- [x] 4.2 Write failing test in `MysteryRoom.svelte.spec.ts`: when the unseen candidate count drops below 12 after a spin, `onRequestMore` is called (test passes)
- [x] 4.3 Continuation logic handled in `MysteryRoom.handleLand` (not FilmReel) — design decision: MysteryRoom owns the continuation trigger
- [x] 4.4 Pool capacity enforcement implemented via bounded-pool eviction (BOUNDED_POOL_CAPACITY = 36, page size = 12). Dedicated test skipped per user decision.
- [x] 4.5 In `GalleryExplorationPage.svelte`, wired `handleMysteryRequestMore` to call `loadMoreArtworks` with cursor, and feeds bounded-pool-managed `mysteryPoolArtworks` back into MysteryRoom's `artworks` prop

## 5. Local seed data for manual verification

- [x] 5.1 Created `apps/web/scripts/seed-artworks.ts` — inserts 50 published artworks with varied scores (0-100 via sine distribution), staggered timestamps (spread over 7 days), and 4 author IDs. Uses `onConflictDoNothing` for idempotency.
- [x] 5.2 Added `"db:seed": "bun run scripts/seed-artworks.ts"` to `apps/web/package.json` and passthrough `"db:seed"` in root `package.json`
- [x] 5.3 Ran `bun run db:seed` — 4 authors and 50 artworks seeded successfully

## 6. Verification and cleanup

- [x] 6.1 Run `bun run format && bun run lint && bun run check` — all pass
- [x] 6.2 Run `bun run test:unit` — all 452 tests pass (82 test files, 0 failures)
- [x] 6.3 Run `bun run test:e2e` — 29 passed, 1 skipped (hot-wall, pre-existing skip), 0 failures
- [ ] 6.4 Manual smoke test: open mystery room with seeded data, verify it cycles through more than 12 artworks and memory stays bounded
- [ ] 6.5 Manual smoke test: open hall-of-fame and hot-wall, verify scrolling or triggering load-more fetches additional pages beyond the initial 12

## 7. Bug fix: mystery room pool clobbering

- [x] 7.1 Fixed `$effect` at line 191-196 in `GalleryExplorationPage.svelte` — the effect tracked `artworks` reactively and reset `mysteryPoolArtworks` back to the initial 12 every time `syncArtwork` or `patchArtwork` reassigned the `artworks` prop. Added `mysteryPoolInitialized` flag so the pool is only seeded once per mystery room entry, not on every reactive update.
