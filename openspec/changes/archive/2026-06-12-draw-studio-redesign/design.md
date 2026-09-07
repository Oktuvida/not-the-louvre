# Design notes — draw-studio-redesign

Diagnosis evidence gathered 2026-06-12 (all line numbers from that date).

## Root causes of the overflow (user screenshot: book under tray, tray cropped)

1. `StudioDrawingPage.svelte:873-902` — `.studio-book-frame`:
   - `height: clamp(29rem, 78vh, 56rem)`, width is **derived** (book spread is
     `width: fit-content` of square canvas + spine + cover ⇒ width ≈ 2×height).
   - Open-state choreography: `--book-open-offset-x: 30rem; --book-open-offset-y: 2rem;
     --book-open-scale: 1.3` applied as `transform: translate(...) scale(...)`.
     Transforms don't affect layout ⇒ the scaled book paints over the tray
     column and is clipped by `.studio-page { overflow-hidden }`.
   - Closed-state: `--book-closed-offset-x: 20rem` (same class of problem).
2. `StudioDrawingPage.svelte:744-746` — desktop grid only at `xl`:
   `xl:grid-cols-[minmax(0,1fr)_15rem]`. Between 701px and 1280px there is no
   layout tier (still the desktop branch, single column).
3. `StudioDrawingPage.svelte:43` — `MOBILE_STUDIO_MEDIA_QUERY = '(max-width: 700px)'`
   (binary switch, `isMobileViewport` state line 191).
4. `tools-stage` (`:904-909`): `width: min(100%, 15rem); margin-left: clamp(...)` —
   in-flow, fine; it is the BOOK that invades it, plus the page right padding
   (`px-6`) is the only thing between tray and viewport edge.
5. Global `Ops` link (routes/+layout.svelte, `.ops-link`) floats top-right and
   overlaps the studio header at some widths.

## Sizing formula to implement

Let `headerH ≈ 5rem`, `padX = 3rem`, `trayW = clamp(12rem, 15vw, 15rem)`, gap `2rem`.

```
spreadH = min(100dvh - headerH - 2rem, (100vw - trayW - padX - gap) / spreadRatio)
```

`spreadRatio = spreadW / spreadH ≈ 2.05` (cover page + 14px spine + canvas page,
both pages square-ish; measure exactly in DrawingBookStage before hardcoding).
Apply as `height` + `aspect-ratio` on `.studio-book-frame`; settled open state
has NO transform. Mid-flight animation may still translate/scale (transients
can't cause persistent overlap).

## Book chrome (DrawingBookStage.svelte)

Current: `.book-spread` `border: 3px solid #1a1611; background: #fbf7f0`;
`.book-spine` dark 14px gradient (lines ~175-215). Redesign hooks live entirely
in this component's <style>; the stage state machine (`stageState` prop,
`onOpenRequest/onOpened/onClosed`, `--book-open-duration`) must not change.

Visual targets (NTL language, see memory file gallery-polish-backlog.md):
- cover board: umber-walnut `linear-gradient(135deg,#4a3522,#3a2817,#2e1f10)`
  family + worn corners (radial darkening), debossed wordmark.
- fore-edge: 4-6 stacked 1-2px cream lines (#f3ead8/#e7dcc6 alternating).
- gutter: vertical soft shadow both sides of spine; thread stitches =
  dashed border segment or tiny SVG.
- left page hosts the cover post-its (already exist: `.cover-postit*` in
  StudioDrawingPage) — keep their classes, just anchor them visually to the page.
- right page: mount canvas like `.canvas-mat` in AvatarSketchpad.svelte
  (warm border #d6cfc5, padding, optional corner tapes).

## Known test hooks (must survive)

- `data-testid="studio-mobile-canvas-card"` (mobile branch).
- Tray: aria-labels `Select color ${color}`, `Brush size`; sticker buttons
  Publish/Clear text; `mobile` prop renders `palette-mobile-grid`.
- DrawingCanvas: pointer tests mock prototype getContext — the canvas element
  must stay the FIRST canvas in its container (overlay canvas is second).
- StudioDrawingPage spec: journal test draws via dispatched PointerEvents with
  mocked getBoundingClientRect — canvas sizing changes are safe, but keep
  width/height attrs 768.

## Gotchas from this project (do not relearn)

- vitest client project loads NO Tailwind: any geometry the tests depend on
  (canvas mat aspect, tray menu positions) must live in component `<style>`.
- Never `height: 100%` on a canvas inside an `aspect-ratio` parent (Safari).
- Buttons that Playwright clicks must not move on hover/active (use inner
  span for motion), and nothing positioned/promoted inside a preserve-3d
  flip context (book opening uses 3D!) — gate decorations on the animation
  state like the postcard's safety actions (`!isFlipped && !isLifting`).
- Edit tool fails on multiline tab-indented strings: use marker-anchored
  node scripts + `prettier --write`.
- Verification loop: `bun run check` (0 errors; 1 pre-existing
  GalleryLayoutFrame warning OK), `bun run lint`, targeted
  `bunx vitest run --project client <file>`, full suite
  `node scripts/run-vitest-project.mjs --project client --allow-hang-after-pass`
  (baseline 248 pass / 7 EntrySceneController WebGL failures).
- AvatarSketchpad.svelte.spec.ts does NOT run in the full client suite.
