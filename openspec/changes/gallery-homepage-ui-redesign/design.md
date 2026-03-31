## Context

The homepage and gallery pages currently use uniform UI primitives — bordered cards, emoji medals, flat backgrounds, and a single hardcoded gold frame color. Six detailed HTML mockups have been designed and approved (polaroid cards, post-it notes, wax seal medals, brass plaques, metallic frames, visitor badges) that establish the museum-whimsy visual identity. This design document captures the technical approach for implementing them.

### Current state

- **Frame renderer** (`artwork-frame-canvas.ts`): Canvas-based, ~550 lines. Uses a single hardcoded `COLORS` constant with gold shades (`gA`–`gD`) plus mat colors. `ArtworkFrameRenderOptions` has `aged`, `castShadow`, `cornerOrnaments`, `innerMouldingRatio`, `matRatio`, `mouldingRatio` — no color parameter.
- **Frame model** (`model/frame.ts`): Defines frame presets. `resolveArtworkFrame()` picks premium presets for podium positions 1–3 and standard for the rest. Uses a private `hashString()` for deterministic selection.
- **Gallery page** (`GalleryExplorationPage.svelte`, ~498 lines): Conditional rendering per room — podium layout for Hall of Fame, `MysteryRoom` for mystery, `ArtworkCard` grid for hot-wall/your-studio.
- **Rooms model** (`rooms.ts`): Four rooms with `id`, `name`, `shortName`, `description`, `color`. No post-it metadata.
- **Homepage** (`PersistentNav.svelte`): "Signed in as" card with avatar + nickname. Nav buttons at bottom-left include a Mystery button.
- **Auth overlay** (`AuthOverlay.svelte`, ~723 lines): 6 view states. The avatar-drawing step is small and could be bigger.
- **Fonts**: Baloo 2 and Fredoka loaded from Google Fonts. Caveat is not yet loaded.
- **Background**: Gallery uses flat `bg-[#f5f0e8]`. `gallery-bg.webp` exists in `static/` but is unused.

### Constraints

- Mystery room is out of scope — no changes.
- `/draw` route is out of scope.
- Gallery room navigation tabs stay as `GameLink` buttons — post-its are only for room descriptions.
- All visual randomization (rotations, attachment types, badge colors) must be deterministic from content IDs or user IDs using the existing `hashString()` pattern.
- No backend, API, or database schema changes.

## Goals / Non-Goals

**Goals:**

- Replace uniform UI elements with handcrafted museum-whimsy components across homepage and gallery
- Extend the canvas frame renderer to support gold/silver/bronze color schemes
- Create 5 new reusable Svelte components (VisitorBadge, PolaroidCard, WaxSealMedal, BrassPlaque, PostItNote)
- Add the Caveat handwriting font for post-its and polaroid captions
- Use `gallery-bg.webp` as the gallery background with a transparent top bar
- Keep all randomization deterministic from IDs

**Non-Goals:**

- Mystery room changes
- Draw route changes
- Changing gallery room navigation tabs to post-it style
- Backend/API/schema changes
- Accessibility audit (separate concern, future work)
- Animation or transition polish (can follow as a separate change)

## Decisions

### D1: New components live under `shared-ui/components/`

**Decision:** Place `VisitorBadge`, `PolaroidCard`, `WaxSealMedal`, `BrassPlaque`, and `PostItNote` in `apps/web/src/lib/features/shared-ui/components/`.

**Rationale:** These components are used across multiple feature modules (homepage uses VisitorBadge, gallery uses the rest). The `shared-ui` feature already holds cross-cutting UI primitives (`GameButton`, `GameLink`, `StudioPanel`). Placing them here avoids circular imports between `home-entry-scene` and `gallery-exploration`.

**Alternative considered:** Placing each component in the feature module that uses it most. Rejected because PolaroidCard and WaxSealMedal are used in both gallery and homepage (top-3 preview), and the existing pattern already uses `shared-ui` for cross-feature components.

### D2: Extend `COLORS` to a `COLOR_SCHEMES` map, add `colorScheme` to render options

**Decision:** Replace the single `COLORS` constant in `artwork-frame-canvas.ts` with a `COLOR_SCHEMES` record keyed by `'gold' | 'silver' | 'bronze'`. Add an optional `colorScheme` property to `ArtworkFrameRenderOptions`. Default to `'gold'` for backward compatibility.

**Rationale:** Minimal change surface — the canvas drawing code already references `COLORS.gA`, `COLORS.gB`, etc. By resolving the active scheme at the top of `drawArtworkFrame` and assigning it to a local `colors` variable, the rest of the function body requires only a variable rename from `COLORS` to `colors`. No structural changes to the drawing algorithm.

**Alternative considered:** Passing raw RGB arrays as render options. Rejected because it leaks palette details to every call site and makes the API harder to use. The three named schemes cover all current needs.

### D3: Deterministic randomization reuses `hashString()`

**Decision:** Export `hashString()` from `model/frame.ts` (currently private) and use it throughout for deterministic visual variation — badge color selection, tape-vs-pin choice, rotation angles, post-it position offsets.

**Rationale:** The function already exists and uses the classic multiply-by-31 unsigned hash. It produces well-distributed values for short strings (artwork IDs, user IDs). No reason to introduce a second hash function.

**Alternative considered:** Creating a shared `hash.ts` utility. Acceptable but unnecessary — the function is 7 lines and has no dependencies. Moving it would touch more files for no functional benefit. If more hash consumers appear later, a refactor can extract it.

### D4: Caveat font loaded via Google Fonts alongside existing fonts

**Decision:** Add `family=Caveat:wght@400;700` to the existing Google Fonts `<link>` in `app.html`.

**Rationale:** The app already loads Baloo 2 and Fredoka from Google Fonts with preconnect. Adding Caveat to the same request is a single URL parameter change — no new infrastructure, no self-hosting complexity, and consistent with the existing pattern.

**Alternative considered:** Self-hosting via `@fontsource/caveat`. Would give offline support and version pinning but introduces a new dependency pattern inconsistent with the rest of the app. Not worth it for one additional font.

### D5: Post-it metadata added to `GalleryRoomConfig`

**Decision:** Extend `GalleryRoomConfig` in `rooms.ts` with `postItColor` (hex string) and `postItAttachment` (`'tape' | 'pin'`) fields. Each room gets a unique post-it color (yellow for Hall of Fame, pink for Hot Wall, blue for Mystery, green for Your Studio).

**Rationale:** Post-it notes are rendered per-room with room-specific colors. Storing this alongside existing room config keeps the data co-located and avoids a separate lookup. The attachment type per room gives visual variety without runtime randomization.

**Alternative considered:** Deriving post-it color from the existing `color` field. Rejected because the existing room colors (gold, red, grey-green, peach) don't match the intended post-it palette (classic yellow, pink, blue, green).

### D6: PolaroidCard replaces ArtworkCard for non-podium grid views

**Decision:** In `GalleryExplorationPage.svelte`, the `ArtworkCard` component is replaced with `PolaroidCard` for Hot Wall, Your Studio, and Hall of Fame non-podium artworks. The existing `ArtworkCard` continues to be used where a framed presentation is needed (podium top-3). `PolaroidCard` receives the artwork data, artist avatar, and a deterministic seed for attachment/rotation variation.

**Rationale:** The polaroid aesthetic is central to the redesign. Rather than modifying `ArtworkCard` to support two visual modes, a separate component keeps each one focused. `ArtworkCard` with `ArtworkFrame` handles the canvas-rendered framed look; `PolaroidCard` handles the casual pinned-to-wall look.

### D7: CSS-only implementations for wax seals, brass plaques, and visitor badges

**Decision:** All decorative components (WaxSealMedal, BrassPlaque, VisitorBadge) are pure CSS + HTML with Tailwind utilities and inline styles where gradients/shadows require specificity. No canvas rendering, no SVG, no image assets.

**Rationale:** The mockups demonstrate these are achievable with CSS gradients, box-shadows, and border-radius tricks. CSS is easier to maintain, responsive by default, and doesn't require canvas context management. The wax seal's scalloped edge uses a radial-gradient mask pattern proven in the mockups.

**Alternative considered:** SVG for wax seals. Would give crisper edges at extreme zoom but adds complexity. At normal viewing sizes CSS is indistinguishable, and the mockups confirm the quality.

### D8: Gallery background applied via CSS on the gallery layout

**Decision:** Apply `gallery-bg.webp` as a `background-image` on the gallery page's root container with `background-size: cover`, `background-repeat: repeat`, and `background-attachment: fixed`. Remove the `bg-[#f5f0e8]` class. The top bar becomes transparent (`bg-transparent`), removing its white background and `border-b-4`.

**Rationale:** The museum wall texture should tile and remain fixed during scroll to create the illusion of objects mounted on a wall. `background-attachment: fixed` achieves this. The transparent top bar lets the texture show through, making the brass plaque and post-its appear to sit directly on the wall.

## Risks / Trade-offs

**[Caveat font loading adds weight]** → The Caveat font adds ~20-40KB to initial page load. Mitigation: It's loaded with `display=swap` so it won't block rendering. The handwriting aesthetic is core to the redesign and cannot be achieved with existing fonts.

**[Canvas frame color scheme is a rendering-time decision]** → Changing the color scheme requires re-rendering the canvas. Mitigation: Frames are already rendered once on mount; the `colorScheme` is static per artwork position and doesn't change at runtime, so no additional renders are triggered.

**[CSS wax seal scalloped edges may render inconsistently across browsers]** → The radial-gradient mask technique for scalloped edges has minor anti-aliasing differences between Chrome and Firefox. Mitigation: The mockups were tested in both browsers with acceptable results. The visual is decorative and minor aliasing differences don't affect usability.

**[`hashString` export is a minor API surface change]** → Exporting a previously private function. Mitigation: The function is pure, stateless, and its behavior is well-defined. Adding an export does not change existing call sites.

**[Post-it attachment metadata couples visual decisions to room config]** → Mixing presentation data into domain config. Mitigation: This is a UI-focused config file — `color` is already a visual property. The post-it fields are optional and only consumed by the rendering layer.

## Open Questions

None — all design decisions are resolved based on the approved mockups and exploration sessions.
