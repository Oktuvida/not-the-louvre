## 1. Foundation — Font and Hash Utility

- [x] 1.1 Add Caveat font (weights 400, 700) to the Google Fonts `<link>` in `apps/web/src/app.html`
- [x] 1.2 Export `hashString()` from `apps/web/src/lib/features/artwork-presentation/model/frame.ts` so other modules can use it for deterministic randomization

## 2. Canvas Frame Color Schemes

- [x] 2.1 Replace the single `COLORS` constant in `artwork-frame-canvas.ts` with a `COLOR_SCHEMES` record containing gold, silver, and bronze palettes (plus mat/matShadow shared colors)
- [x] 2.2 Add `colorScheme?: 'gold' | 'silver' | 'bronze'` to `ArtworkFrameRenderOptions` in `model/frame.ts`
- [x] 2.3 Update `drawArtworkFrame` to resolve the active color scheme from options (default `'gold'`) and replace all `COLORS.` references with the resolved scheme
- [x] 2.4 Update `resolveArtworkFrame()` to assign `colorScheme: 'gold'` for position 1, `'silver'` for position 2, `'bronze'` for position 3
- [x] 2.5 Verify `ArtworkFrame.svelte` passes `colorScheme` through to the canvas renderer

## 3. New Shared UI Components

- [x] 3.1 Create `VisitorBadge.svelte` in `shared-ui/components/` — "HELLO MY NAME IS" badge with 5 color variants, avatar circle, Caveat nickname, deterministic color from user ID hash
- [x] 3.2 Create `PolaroidCard.svelte` in `shared-ui/components/` — polaroid frame with artwork image, avatar in caption area, Caveat title, deterministic tape/pin attachment and rotation from artwork ID hash, optional rank badge
- [x] 3.3 Create `WaxSealMedal.svelte` in `shared-ui/components/` — CSS wax seal with scalloped edges, gold/silver/bronze variants, three sizes (small/medium/large), embossed position number, no animations
- [x] 3.4 Create `BrassPlaque.svelte` in `shared-ui/components/` — metallic gradient background, engraved text, corner screws, three sizes (small/medium/large), configurable text prop
- [x] 3.5 Create `PostItNote.svelte` in `shared-ui/components/` — clean rectangular note with solid color background, Caveat font, tape/pin attachment variant, slight rotation, no ragged edges

## 4. Room Model Update

- [x] 4.1 Add `postItColor` and `postItAttachment` fields to `GalleryRoomConfig` in `rooms.ts`
- [x] 4.2 Set post-it metadata per room: yellow/tape for Hall of Fame, pink/pin for Hot Wall, blue/tape for Mystery, green/pin for Your Studio

## 5. Gallery Page Integration

- [x] 5.1 Replace the flat `bg-[#f5f0e8]` gallery background with `gallery-bg.webp` (`background-image`, `background-size: cover`, `background-attachment: fixed`)
- [x] 5.2 Remove the solid white background and `border-b-4` from the gallery top bar, make it transparent
- [x] 5.3 Replace the plain text gallery title with the `BrassPlaque` component
- [x] 5.4 Replace the plain bordered room description card with the `PostItNote` component, using each room's post-it color and attachment from the room config
- [x] 5.5 Replace emoji medals (`🥇🥈🥉`) in the Hall of Fame podium with `WaxSealMedal` components (gold/silver/bronze, appropriate sizes)
- [x] 5.6 Update the Hall of Fame podium to pass `colorScheme` to `ArtworkFrame` for positions 1–3 (gold/silver/bronze)
- [x] 5.7 Replace `ArtworkCard` with `PolaroidCard` for Hall of Fame non-podium artworks (ranks 4+), passing rank as badge
- [x] 5.8 Replace `ArtworkCard` with `PolaroidCard` for Hot Wall artworks (no rank badge, deterministic attachment)
- [x] 5.9 Replace `ArtworkCard` with `PolaroidCard` for Your Studio artworks (no rank badge, deterministic attachment)

## 6. Homepage Integration

- [x] 6.1 Replace the "Signed in as" card in `PersistentNav.svelte` with the `VisitorBadge` component
- [x] 6.2 Replace the Mystery nav button with a Logout sticker button (Mystery is reachable from gallery)
- [x] 6.3 Update homepage top-3 preview frames to use metallic color schemes (gold/silver/bronze by position)

## 7. Auth Overlay Styling

- [x] 7.1 Restyle the auth overlay (`AuthOverlay.svelte`) to be larger for the avatar drawing step with improved proportions and museum-consistent aesthetic

## 8. Verification

- [ ] 8.1 Run `bun run format` and fix any formatting issues
- [ ] 8.2 Run `bun run lint` and fix any lint errors
- [ ] 8.3 Run `bun run check` and fix any type errors
- [ ] 8.4 Run `bun run test:unit` and fix any failing unit tests
- [ ] 8.5 Run `bun run test:e2e` and fix any failing e2e tests
