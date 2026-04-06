## 1. Mobile behavior coverage

- [x] 1.1 Add or update component tests for homepage mobile chrome so the persistent top-artwork preview stack is absent on narrow mobile viewports
- [x] 1.2 Add or update gallery tests covering narrow mobile viewport behavior for shell spacing/navigation and Mystery room horizontal presentation

## 2. Homepage mobile simplification

- [x] 2.1 Update `PersistentNav.svelte` so the top-artwork preview stack is hidden on narrow mobile viewports while preserving desktop behavior
- [x] 2.2 Verify the remaining homepage controls still feel balanced on mobile after the preview stack is removed

## 3. Gallery shell mobile tightening

- [x] 3.1 Update `GalleryExplorationPage.svelte` mobile spacing for the sticky header, room navigation mount point, and main content container
- [x] 3.2 Adjust `GalleryRoomNav.svelte` mobile presentation as needed so room links remain browseable on narrow screens without changing desktop behavior
- [x] 3.3 Confirm room note and surrounding gallery chrome no longer rely on desktop-only spacing assumptions on narrow screens

## 4. Mystery mobile horizontal fit

- [x] 4.1 Update `MysteryRoom.svelte` mobile spacing and control sizing so the reel remains the focal point without oversized vertical gaps
- [x] 4.2 Update `FilmReel.svelte` with responsive horizontal reel sizing for narrow viewports while preserving the existing horizontal animation model
- [x] 4.3 Verify Mystery remains horizontally oriented and does not introduce horizontal page overflow on narrow screens

## 5. Verification

- [x] 5.1 Run `bun run format`
- [x] 5.2 Run `bun run lint`
- [x] 5.3 Run `bun run check`
- [ ] 5.4 Run `bun run test`
