# Proposal: Gallery NSFW Consistency and Layout Transition Polish

## Intent

NSFW blur logic is duplicated inline across gallery parent components and missing entirely from the shared `PolaroidCard.svelte` used in three rooms, leaving Hot Wall and Your Studio grids unprotected. Additionally, gallery room navigation triggers full SvelteKit route changes instead of reactive layout transitions, causing blank content, lost scroll position, and repeated data fetches. This change centralizes NSFW handling and introduces a shared gallery layout to persist navigation state across rooms.

## Scope

### In Scope
- Build `NsfwImage.svelte` centralizing blur + click-to-reveal + author exemption.
- Refactor `PolaroidCard.svelte` to use `NsfwImage.svelte` for all image rendering.
- Add `viewer.id` to gallery room `artwork` props so `PolaroidCard` can apply author exemption.
- Create `/gallery/+layout.svelte` to persist nav, header, and detail panel across room changes.
- Add `data-sveltekit-preload-data="hover"` to `GalleryRoomNav` links.
- Reduce GSAP entry fade duration from 500ms to 250ms and remove the 50ms delay.
- Add `aria-label` support to blurred NSFW images.

### Out of Scope
- Server-side NSFW filtering (still client-side only; deferred to later phase).
- Focus trap for `ArtworkDetailPanel`.
- Virtualization of Hot Wall supporting grid.
- Empty state for Mystery Room.
- FilmReel error handling for silent failures.

## Capabilities

### New Capabilities
- `nsfw-reusable-component`: A shared component enforcing consistent blur, reveal, accessibility, and author exemption semantics across all gallery views.
- `gallery-layout-persistence`: A shared `/gallery` layout that prevents full-route unmounts and preserves room navigation continuity.

### Modified Capabilities
- `artwork-discovery`: Gallery room presentation layer updated so `PolaroidCard` passes `viewer.id` through room data wiring for NSFW author exemption.

## Approach

- Extract `NsfwImage.svelte` from current inline blur snippets, handling `blurred`, `onClickReveal`, `aria-label`, and a `skipBlurForAuthor` prop. Plug it into `PolaroidCard.svelte`, replacing raw `<img>` tags.
- Author exemption: In `YourStudioRoom`, pass the current user ID as `viewer.id` on each artwork object rendered through `PolaroidCard`.
- Add `apps/web/src/routes/gallery/+layout.svelte` wrapping all `/gallery/*` subroutes. Include `GalleryRoomNav`, the detail panel shell, and a keyed outlet for room content. This prevents entire route teardown on room switches.
- Preload room data on hover via `data-sveltekit-preload-data="hover"` on `GalleryRoomNav` anchor tags.
- Shrink GSAP fade constants from 500ms exit / 50ms delay to 250ms exit / 0ms delay.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/lib/features/gallery/NsfwImage.svelte` | New | Reusable NSFW blur + reveal component. |
| `apps/web/src/lib/features/gallery/PolaroidCard.svelte` | Modified | Switches from raw `<img>` to `NsfwImage`; accepts `viewerId`. |
| `apps/web/src/lib/features/gallery/YourStudioRoom.svelte` | Modified | Passes `viewer.id` to artwork props. |
| `apps/web/src/lib/features/gallery/rooms/*.svelte` | Modified | HallOfFameRoom and HotWallRoom benefit from centralized NSFW blur. |
| `apps/web/src/routes/gallery/+layout.svelte` | New | Shared layout preserving shell across room changes. |
| `apps/web/src/lib/features/gallery/GalleryRoomNav.svelte` | Modified | Adds `data-sveltekit-preload-data="hover"`. |
| `apps/web/src/lib/features/gallery/gsap-animations.ts` or similar | Modified | Reduces fade duration and delay constants. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PolaroidCard refactor breaks image sizing on mobile | Med | Test on smallest breakpoint after swapping `<img>` to `NsfwImage`. |
| +layout.svelte causes route `load` rewrites to fire more often | Low | Verify each subroute still loads via its own `+page.server.ts`. |
| Author exemption logic leaks to non-studio rooms | Low | Guard `skipBlurForAuthor` against `viewerId === artwork.authorId`. |

## Rollback Plan

- Remove `/gallery/+layout.svelte` and restore per-room full route rendering.
- Revert `PolaroidCard.svelte` to raw `<img>` tags and re-inline blur logic in HallOfFameRoom and HotWallRoom parent components.

## Dependencies

None.

## Success Criteria

- [ ] `PolaroidCard.svelte` uses `NsfwImage.svelte` for all artwork images.
- [ ] Your Studio grid bypasses blur for artworks authored by the current user.
- [ ] Gallery room switching preserves scroll position and does not flash blank content.
- [ ] `data-sveltekit-preload-data="hover"` is present on all room nav links.
- [ ] GSAP fade-in duration is ≤ 250ms with 0ms delay.
- [ ] Blurred NSFW images carry an accessible `aria-label`.
