# Tasks: Gallery NSFW Consistency and Layout Transition Polish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 420–500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (NSFW component + wiring) → PR 2 (layout persistence) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | NSFW component, model enrich, room wiring | PR 1 | TDD red/green for NsfwImage + PolaroidCard |
| 2 | Gallery layout persistence, GSAP timing | PR 2 | Depends on PR 1; moves shell to +layout |

## Phase 1: Foundation

- [x] 1.1 Add `authorId: string` to `Artwork` interface in `apps/web/src/lib/features/artwork-presentation/model/artwork.ts`
- [x] 1.2 Map `author.id` to `authorId` in `apps/web/src/lib/features/gallery-exploration/gallery-adapter.ts`
- [x] 1.3 Spread `...restProps` onto `<a>` in `apps/web/src/lib/features/shared-ui/components/GameLink.svelte`

## Phase 2: Core NSFW Component

- [x] 2.1 RED: Write failing unit test for `NsfwImage` blur rendering based on prop
- [x] 2.2 GREEN: Create `apps/web/src/lib/features/gallery-exploration/components/NsfwImage.svelte` with blur classes and `aria-label`
- [x] 2.3 REFACTOR: Extract blur CSS constants inside `NsfwImage.svelte`
- [x] 2.4 RED: Write failing unit test asserting `PolaroidCard` forwards `viewerId` to `NsfwImage`
- [x] 2.5 GREEN: Add `viewerId` prop and `revealed` state to `PolaroidCard.svelte`; replace `<img>` with `NsfwImage`

## Phase 3: Room Wiring

- [x] 3.1 Pass `viewerId` to `PolaroidCard` in `YourStudioRoom.svelte`
- [x] 3.2 Pass `viewerId` to `PolaroidCard` and replace podium inline blur in `HallOfFameRoom.svelte`
- [x] 3.3 Pass `viewerId` to `PolaroidCard` and replace lead-artwork inline blur in `HotWallRoom.svelte`

## Phase 4: Layout Persistence

- [ ] 4.1 Create `apps/web/src/routes/gallery/+layout.ts` exporting `roomId` from params
- [x] 4.2 Define `GalleryLayoutContext` in `+layout.svelte` exposing `selectedArtwork`, `openArtwork`, `closeArtworkDetail` (implemented as shared panel/action bindings)
- [ ] 4.3 Strip `GalleryShell` and `ArtworkDetailPanel` from `GalleryExplorationPage.svelte` (header fallback still retained for direct component rendering)
- [x] 4.4 Create `apps/web/src/routes/gallery/+layout.svelte` mounting `GalleryShell`, keyed `<slot />`, and `ArtworkDetailPanel` (implemented incrementally; panel now layout-owned via context with local fallback)
- [x] 4.5 Add `data-sveltekit-preload-data="hover"` to `GalleryRoomNav.svelte` links
- [x] 4.6 Reduce GSAP fade duration to 250ms and delay to 0ms in gallery entry animation file

## Phase 5: Testing & Verification

- [x] 5.1 Run unit tests for `NsfwImage` and `PolaroidCard` assertions
- [ ] 5.2 Write integration test asserting `GalleryRoomNav` links carry `data-sveltekit-preload-data="hover"`
- [ ] 5.3 Write E2E test verifying room switch preserves scroll and avoids blank flash
- [ ] 5.4 Write E2E test asserting blurred NSFW images expose `aria-label`
- [ ] 5.5 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` (`format`, `lint`, `check` pass; full `test` still depends on local integration services)

## Next Slice: Gallery Shell Extraction

### Goal

Move the persistent gallery shell into `/gallery/+layout.svelte` without breaking the current `GalleryExplorationPage` test contract in one jump.

### Scope

- [x] Create a dedicated route-level harness/spec for `/gallery/+layout.svelte`
- [x] Move only wall background, particles, and `GalleryRoomNav` into the layout first
- [x] Keep `ArtworkDetailPanel` in `GalleryExplorationPage` for this slice
- [x] Update gallery specs so shell assertions target the layout/harness instead of `GalleryExplorationPage`
- [x] Verify room switches keep the shell mounted while page content rerenders cleanly

### Explicitly Out of Scope

- [x] Do not move `ArtworkDetailPanel` into the layout in this slice
- [ ] Do not introduce `GalleryLayoutContext` yet
- [ ] Do not change room data loading strategy yet

### Exit Criteria

- [ ] `GalleryExplorationPage` renders room content only
- [x] Layout-level shell tests replace page-level shell assumptions
- [x] `GalleryExplorationPage.svelte.spec.ts` no longer asserts header/background/nav ownership
- [x] `bun run lint` and `bun run check` pass

## Third/Fourth Slice Result

- [x] Route layout owns background, particles, nav, and `ArtworkDetailPanel`
- [x] `GalleryExplorationPage` registers panel/action bindings through shared context
- [x] Direct component tests still work through local fallback rendering
- [x] Accumulator-backed rooms reseed when `pageInfo` changes
- [ ] Remove remaining local fallback header/panel from `GalleryExplorationPage`
