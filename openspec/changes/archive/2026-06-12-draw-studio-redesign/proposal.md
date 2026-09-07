# Change: draw-studio-redesign

## Why

Three intertwined problems on `/draw` (desktop):

1. **The layout breaks on normal screens.** Same bug class as the gallery's 18+
   note: the open-book choreography uses **fixed rem offsets and an absolute
   scale** (`translate(30rem, 2rem) scale(1.3)` on `.studio-book-frame`,
   `StudioDrawingPage.svelte:881-901`) that were tuned on a very wide monitor.
   The book's width derives from its height (`fit-content` spread at
   `clamp(29rem, 78vh, 56rem)`), so on a ~1500-2000px-wide screen the scaled
   spread paints OVER the tool tray's grid column and is clipped by the page's
   `overflow-hidden`. The tray itself sits flush against the right viewport
   edge and gets cropped.

2. **The book doesn't speak the house language.** The spread is a flat
   near-black slab (`#1a1611` border, dark spine) while the rest of the app
   now runs on the scrapbook language (warm paper, tape, stitched/worn
   objects). The cover post-its (title / NSFW / fork) float over the page
   instead of looking placed on it.

3. **The palette tray placement is brittle.** It lives in a fixed `15rem`
   grid column (`xl:grid-cols-[minmax(0,1fr)_15rem]`) that only exists at
   `xl` (≥1280px); between the mobile cutoff (`max-width: 700px`) and `xl`
   there is no intermediate layout, and at `xl+` the book's transform ignores
   the column boundary anyway.

## What Changes

### 1. Responsive layout contract (the bug fix — do first)

- The open book must be sized by **both axes**:
  `size = min(height-budget, width-budget)` where the width budget is the
  grid cell (viewport minus tray column minus padding), mirroring the
  postcard's `clamp(16rem, calc(100dvh - 12rem), 30rem)` approach. No
  viewport-blind `scale(1.3)` / `translate(30rem)` end states: the closed→open
  cinematic may keep transforms mid-flight, but the **settled open state is
  transform-free** (scale 1, offset 0) inside a frame that already has its
  final size, so it can never overlap the tray or the viewport edge.
- Grid: `minmax(0,1fr) clamp(12rem, 15vw, 15rem)` from `lg` (not `xl`),
  centered items. Add a **middle tier** (701px–lg): book full-width, tray
  docked as a horizontal strip below (reuse the existing `mobile` tray mode).
- Header chrome (`Exit Studio`, the global `Ops` link) gets reserved space —
  no overlap with the book at any width.
- **Acceptance:** at 1280×800, 1440×900, 1512×982 and 1920×1080 — book fully
  visible, tray fully visible and not cropped, no horizontal scroll, drawing
  page ≥ 480px square. Verified with a Playwright viewport matrix.

### 2. Book redesign (NTL aesthetic)

Direction: **the artist's working sketchbook**, not a leather tome.

- Cover/board: warm umber-walnut with board texture and worn corners;
  "NOT THE LOUVRE" debossed (refine the existing vertical mark).
- Fore-edge: visible stacked cream page edges (deckle lines) so the spread
  reads as a thick sketchbook.
- Spine/gutter: stitched thread detail + soft page-curl shading at the
  gutter of the open spread.
- Left page: the post-its (title / NSFW / fork) sit ON the page, taped, with
  the established `postit-tape` + slight per-note rotation.
- Right page: the canvas mounted like the avatar sketchpad mat (warm border,
  corner tapes optional).
- The open/close choreography API (`stageState`, `onOpened`, `onClosed`,
  `openingDurationMs`) is untouched.

### 3. Palette tray fit

- Keep the paper-scrap tray, but its width adapts (`clamp(12rem, 15vw, 15rem)`)
  and it never touches the viewport edge (min `0.75rem` inset).
- Middle tier and mobile reuse the horizontal `mobile` tray (dabs ≥ 40px touch
  targets).
- Stretch goal (separate change): dock the tray to the book's right page edge
  as a fold-out paint shelf.

## Impact

- `apps/web/src/lib/features/studio-drawing/StudioDrawingPage.svelte` —
  layout grid, book-frame sizing/choreography CSS, middle-tier branch.
- `apps/web/src/lib/features/studio-drawing/components/DrawingBookStage.svelte`
  — book chrome redesign (cover, fore-edge, spine, page mounting).
- `apps/web/src/lib/features/studio-drawing/tools/DrawingToolTray.svelte` —
  width adaptivity only (visual design already done).
- Specs: `StudioDrawingPage.svelte.spec.ts` keeps `data-testid`
  `studio-mobile-canvas-card` and tray aria-labels; new assertions for the
  middle tier are additive. No logic changes anywhere — strokes, drafts,
  publish, fork, NSFW flows untouched.

## Out of scope

- Tray-docked-to-book fold-out (stretch, separate change).
- Mobile drawing UX changes beyond tray sizing.
- Any backend/API work.
