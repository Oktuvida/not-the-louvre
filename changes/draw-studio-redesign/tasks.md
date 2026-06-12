# Tasks — draw-studio-redesign

## Phase 1 — Responsive layout fix (highest value, do first)

- [x] 1.1 Measure the real spread aspect ratio in DrawingBookStage (open state)
      and record it as a CSS var (`--book-spread-ratio`).
- [x] 1.2 Replace `.studio-book-frame` fixed-offset/scale choreography:
      settled open state transform-free; frame sized with the min(height,
      width-budget) formula from design.md.
- [x] 1.3 Grid from `lg`: `minmax(0,1fr) clamp(12rem, 15vw, 15rem)`; tray inset
      ≥ 0.75rem from the viewport edge.
- [x] 1.4 (compact layout now serves ≤1023px; MOBILE_STUDIO_MEDIA_QUERY raised) Middle tier (701px–lg): book full-width + horizontal `mobile` tray
      docked below (reuse existing mobile tray mode in the desktop branch).
- [x] 1.5 Reserve header space; audit global `.ops-link` overlap on /draw.
- [x] 1.6 (plus 1000×565 short-landscape case) Playwright viewport matrix (1280×800, 1440×900, 1512×982, 1920×1080):
      book + tray fully visible, no horizontal scroll, canvas ≥ 480px.
- [x] 1.7 Full verification loop (check / lint / targeted specs / full suite).

## Phase 2 — Book chrome redesign

- [ ] 2.1 Cover board: umber-walnut texture, worn corners, debossed wordmark.
- [ ] 2.2 Fore-edge stacked page lines; spine stitches; gutter shading.
- [ ] 2.3 Left page: anchor cover post-its (taped, slight rotations).
- [ ] 2.4 Right page: canvas mounted on a warm mat (AvatarSketchpad style).
- [ ] 2.5 Open/close animation regression pass (stage states + reduced motion).

## Phase 3 — Tray fit + polish

- [ ] 3.1 Tray width adaptivity (`clamp`), dab tap targets ≥ 40px in mobile.
- [ ] 3.2 Optional stretch (separate change): fold-out paint shelf docked to
      the book's right page.

## Verification baseline

Full client suite baseline: 248 pass / 7 EntrySceneController WebGL failures.
`bun run check`: 0 errors / 1 pre-existing warning (GalleryLayoutFrame).

## Phase 1 implementation notes (done 2026-06-12)

- Wing reservation is conditional (≥1024px): below that the compact layout
  renders (MOBILE_STUDIO_MEDIA_QUERY = max-width: 1023px; spec mocks updated).
- Height budget: --book-h = max(20rem, min(100dvh - 10rem, width-budget, 56rem)),
  computed stepwise with a static 30rem height fallback line for older engines.
- CRITICAL: the width budget must use min(100vw, 1800px) because <main> is
  capped (max-w-[1800px], raised from 1600). Budgeting against raw 100vw
  over-sizes the book on wide screens and it invades the tray.
- --book-chrome-w: 7rem (over-reserve; 5.5rem caused tray overlap).
- Compact canvas card capped by height: max-width: max(18rem, calc(100dvh - 9rem)).
- Verified matrix: 1000×565 (compact), 1280×800, 1512×982, 2000×1130 — no
  overlap, no h-scroll, canvas 275/369/505px; full suite baseline 248/7.

## Phase 1 rework (2026-06-12, after user feedback "sigue mal")

- REQUIREMENT CLARIFIED: closed /draw book must ~match the 3D entry handoff
  (portrait book, ~70% viewport height, slightly left of center); open book
  must MAXIMIZE the canvas.
- Final architecture: ONE exact var chain on .studio-book-frame —
  --book-h (both-axis budget) → --page-h (−4.2rem fixed stage chrome) →
  --page-w (·10/12) → --book-wing (+7.5rem). DrawingBookStage consumes
  --page-w as EXPLICIT width on .canvas-page/.book-spread/.book-block
  (fixed 12px block padding) because aspect-ratio+height:100% intrinsic
  width resolves differently per engine (Safari fell back to the canvas's
  768px and the cover went landscape — the user's screenshot).
- Closed state: translateX(calc(var(--book-wing) / -2)) — a RELATIVE shift
  (half its own wing), no rem offsets, rotate −1.5deg; opening slides right
  while the cover unfolds left, like a real book. Open state transform-free.
- Removed legacy media-query overrides (max-1279/max-700 .studio-book-frame
  rules with --book-*-offset/scale vars) that silently sabotaged 1024-1279.
- Verified: 2000×1130 canvas 587px (closed cover 736×774 centered ≈ 3D
  handoff), 1512 → 450px, 1280 → 351px, no overlap/h-scroll anywhere;
  studio specs 32/32.
