# Design: Gallery NSFW Consistency and Layout Transition Polish

## Technical Approach

Centralize NSFW blur rendering into a new `NsfwImage.svelte` component, then refactor `PolaroidCard.svelte` and inline NSFW snippets in `HallOfFameRoom` and `HotWallRoom` to use it. Populate `authorId` on the `Artwork` model so parents can compute the blur predicate. Create a `/gallery/+layout.svelte` that persists `GalleryShell`, `GalleryRoomNav`, and `ArtworkDetailPanel` across subroute changes; room content is rendered via a keyed `<slot />`. Shrink GSAP entry fade constants from 500 ms to 250 ms with zero delay. Forward `data-sveltekit-preload-data="hover"` through `GameLink` so `GalleryRoomNav` can preload room data on hover.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| NSFW component responsibility | Pure presentational (`blurred` prop) vs self-contained state + click handler | Pure keeps parents explicit; self-contained avoids prop drilling but creates nested interactive elements inside existing `<button>` wrappers | **Pure presentational** — `NsfwImage` receives `blurred` and `aria-label` only; parent toggles reveal state |
| Detail panel persistence | Extract into `+layout.svelte` vs keep in `GalleryExplorationPage` with local state | Layout survives room changes and prevents blank flash; requires moving ~180 lines of state/history-sync logic | **Move to `+layout.svelte`** |
| Share state between layout and page | Svelte context vs shared module vs props | Context is explicit and layout-scoped; shared module is easy to import but harder to trace | **Context** — `GalleryLayoutContext` exposes `selectedArtwork`, `openArtwork`, and `closeArtworkDetail` |
| Enrich `Artwork` model | Add `authorId` to `Artwork` vs pass `viewerId` separately | Adding `authorId` makes the exemption rule `viewerId === authorId` data-driven and self-contained | **Add `authorId`** |
| Preload attribute plumbing | `...restProps` on `GameLink` vs hardcode `data-sveltekit-preload-data` | Rest props is more flexible and reusable across other sticker links | **`...restProps` on `<a>`** |
| GSAP constants | Inline tweak vs new constants file | Only two values change in one file; a constants file is premature | **Inline tweak** |

## Data Flow

```
+layout.svelte
  ├─ GalleryShell (persistent background, header, nav)
  │    └─ GalleryRoomNav (GameLink with data-sveltekit-preload-data="hover")
  ├─ <slot /> keyed by roomId
  │    └─ GalleryExplorationPage (refactored: content + empty state + GSAP fade only)
  │         └─ Room components → PolaroidCard → NsfwImage(blurred, aria-label)
  └─ ArtworkDetailPanel
       └─ reads/writes GalleryLayoutContext (selectedArtwork, etc.)
```

Room components derive `blurred = isNsfw && !adultContentEnabled && viewerId !== artwork.authorId && !revealed`. When blurred, `NsfwImage` applies `scale-[1.04] blur-xl saturate-0` and `aria-label="Sensitive artwork, click to reveal"`. Clicking the parent button wrapper toggles `revealed` and stops propagation if still blurred.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/lib/features/gallery-exploration/components/NsfwImage.svelte` | Create | Presentational NSFW image: `blurred`, `aria-label`, no internal state |
| `apps/web/src/lib/features/shared-ui/components/PolaroidCard.svelte` | Modify | Replace `<img>` with `NsfwImage`; add `viewerId` prop; manage local `revealed` state |
| `apps/web/src/lib/features/gallery-exploration/rooms/HallOfFameRoom.svelte` | Modify | Replace podium inline blur with `NsfwImage`; pass `viewerId` to `PolaroidCard` grid cells |
| `apps/web/src/lib/features/gallery-exploration/rooms/HotWallRoom.svelte` | Modify | Replace lead-artwork inline blur with `NsfwImage`; pass `viewerId` to `PolaroidCard` |
| `apps/web/src/lib/features/gallery-exploration/rooms/YourStudioRoom.svelte` | Modify | Pass `viewerId` prop into `PolaroidCard` |
| `apps/web/src/lib/features/gallery-exploration/GalleryExplorationPage.svelte` | Modify | Strip shell (`GalleryShell`) and `ArtworkDetailPanel`; keep room routing, empty state, 18+ note, GSAP fade |
| `apps/web/src/routes/gallery/+layout.svelte` | Create | Mount `GalleryShell` + `GalleryRoomNav`; key `<slot />` on `$page.data.roomId`; mount `ArtworkDetailPanel` fed by context |
| `apps/web/src/routes/gallery/+layout.ts` | Create | Export `load` returning `roomId` from params so layout can derive key |
| `apps/web/src/lib/features/gallery-exploration/components/GalleryRoomNav.svelte` | Modify | Pass `preload="hover"` prop (or direct attribute) to `GameLink` instances |
| `apps/web/src/lib/features/shared-ui/components/GameLink.svelte` | Modify | Spread `...restProps` onto the underlying `<a>` element |
| `apps/web/src/lib/features/artwork-presentation/model/artwork.ts` | Modify | Add `authorId: string` to `Artwork` interface |
| `apps/web/src/lib/features/gallery-exploration/gallery-adapter.ts` | Modify | Map `author.id` to `authorId` in `baseArtwork` / `toGalleryArtwork` |

## Interfaces / Contracts

```ts
// Enriched Artwork
export interface Artwork {
  id: string;
  title: string;
  artist: string;
  authorId: string;        // NEW
  artistAvatar?: string;
  imageUrl: string;
  isNsfw: boolean;
  score: number;
  // ...remaining fields unchanged
}

// NsfwImage Props
interface NsfwImageProps {
  src: string;
  alt: string;
  className?: string;
  blurred: boolean;
  ariaLabel?: string;
}

// PolaroidCard Props addition
interface PolaroidCardProps {
  artwork: Artwork;
  viewerId?: string | null; // NEW
  // ...rest unchanged
}

// GalleryLayoutContext (set in +layout.svelte)
interface GalleryLayoutContext {
  selectedArtwork: Artwork | null;
  openArtwork: (artwork: Artwork) => void;
  closeArtworkDetail: () => void;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `NsfwImage` renders blurred vs unblurred based on prop | Vitest + `@testing-library/svelte` mount with different prop combos |
| Unit | Author exemption logic (`viewerId === authorId`) | Test the derived `blurred` expression in room component harnesses |
| Integration | Room nav links carry `data-sveltekit-preload-data="hover"` | DOM assertion after mount of `GalleryRoomNav` |
| E2E | Room switch preserves scroll and avoids blank flash | Playwright: scroll room, click nav, assert shell elements remain mounted |
| E2E | GSAP fade duration ≤ 250 ms | Playwright `page.evaluate` reading animation duration or visual regression timing |
| E2E | Blurred NSFW images expose `aria-label` | `page.locator('img[aria-label]')` assertion |

## Migration / Rollout

No data migration required. The change is purely client-side. Rollback: remove `+layout.svelte` and restore shell rendering inside `GalleryExplorationPage`; revert `PolaroidCard` to raw `<img>`.

## Open Questions

- [ ] Should `+layout.svelte` also gate `ArtworkDetailPanel`'s realtime subscription, or keep that inside the page context?
- [ ] `GalleryShell.svelte` already exists but is not used by production pages (only test harnesses). Should `+layout.svelte` import `GalleryShell` directly or inline its markup? (Decision: import `GalleryShell` to avoid duplication.)
