## Why

The homepage and gallery pages use plain styled cards, emoji medals, flat backgrounds, and generic UI elements that lack the handcrafted museum-whimsy aesthetic the app is going for. Every element currently looks uniform — the same rounded rectangles, the same borders — which contradicts the art-studio personality the app should project. The visual mockups for post-its, polaroids, brass plaques, wax seals, metallic frames, and visitor badges have been designed and approved. It's time to implement them.

## What Changes

- **Homepage "Signed in as" card** → Replaced with a "HELLO MY NAME IS" visitor badge (5 color variants, deterministic per user, avatar circle, handwritten nickname). Logout button moves below the Gallery/Mystery nav buttons.
- **Homepage top-3 preview frames** → Use the new metallic frame color variants (gold/silver/bronze) driven by podium position, replacing the single gilded frame color.
- **Homepage Mystery nav button** → Replaced with a Logout sticker button (Mystery is reachable from the gallery).
- **Gallery background** → Flat `#f5f0e8` replaced with `gallery-bg.webp` museum wall image, full page coverage.
- **Gallery top bar** → Remove the solid white background and border. Transparent bar — objects sit directly on the museum wall.
- **Gallery title** → Plain text replaced with a brass plaque component (screws, metallic gradient, engraved text).
- **Gallery room descriptions** → Plain bordered card replaced with post-it note components (per-room color, tape/pin attachments, Caveat handwriting font). No ragged edges. Post-it position varies per room to look natural.
- **Gallery emoji medals** → `🥇🥈🥉` with `animate-pulse`/`animate-spin` replaced with CSS wax seal medals (gold/silver/bronze, scalloped edges, three sizes).
- **Gallery Hall of Fame podium** → Updated with metallic frames (gold/silver/bronze), wax seal medals above each frame, and styled pedestals.
- **Gallery Hall of Fame non-podium artworks** → Plain framed cards replaced with polaroid cards (avatar in caption area, tape/pin attachments, Caveat handwriting, rank badges).
- **Gallery Hot Wall artworks** → All artworks shown as polaroid cards (no frames). Tape or pin attachment randomly chosen per card.
- **Gallery Your Studio artworks** → All artworks shown as polaroid cards. Tape or pin attachment randomly chosen per card.
- **Canvas frame renderer** → Extended with `colorScheme` option (`gold`/`silver`/`bronze`) so the existing `drawArtworkFrame` supports three metal palettes instead of one hardcoded gold.
- **Auth overlay (Login/Signup)** → Restyled to be larger for the avatar drawing step and more consistent with the museum aesthetic. Uses the existing `StudioPanel` but with improved proportions and artistic styling.
- **Gallery room navigation tabs** → **NOT changed** (stays as GameLink buttons). Post-it style is only for room descriptions.
- **Mystery room** → **NOT changed** (out of scope).

## Capabilities

### New Capabilities

- `visitor-badge`: Reusable "HELLO MY NAME IS" visitor badge component with color variants, avatar display, and handwritten nickname.
- `polaroid-card`: Reusable polaroid-style artwork card with avatar in caption area, tape/pin attachment variants, rank badge, and Caveat handwriting.
- `wax-seal-medal`: Reusable CSS wax seal medal component replacing emoji medals, with gold/silver/bronze variants and three sizes.
- `brass-plaque`: Reusable brass plaque component with screws, metallic gradient, and engraved text.
- `post-it-note`: Reusable post-it note component with per-room colors, tape/pin attachments, corner curls, and handwriting font.
- `metallic-frame-colors`: Extension of the existing canvas frame renderer to support gold/silver/bronze color palettes.
- `gallery-wall-background`: Gallery page uses `gallery-bg.webp` as the museum wall background with transparent top bar.

### Modified Capabilities

- `artwork-discovery`: Hall of Fame podium rendering changes (metallic frames, wax seals, polaroid grid for non-podium). Hot Wall and Your Studio switch to polaroid layout. Gallery background and top bar change.

## Impact

- **Components created**: `VisitorBadge`, `PolaroidCard`, `WaxSealMedal`, `BrassPlaque`, `PostItNote`
- **Components modified**: `PersistentNav.svelte`, `GalleryExplorationPage.svelte`, `ArtworkCard.svelte`, `ArtworkFrame.svelte`, `AuthOverlay.svelte`
- **Canvas code modified**: `artwork-frame-canvas.ts` (add color schemes), `model/frame.ts` (add `colorScheme` to render options and resolve logic)
- **Model modified**: `rooms.ts` (add post-it color and attachment metadata per room)
- **Assets used**: `gallery-bg.webp` (already exists in `apps/web/static/`)
- **Font dependency**: Caveat font (Google Fonts, already loaded in mockups — needs adding to the app)
- **No API changes, no schema changes, no backend changes**
