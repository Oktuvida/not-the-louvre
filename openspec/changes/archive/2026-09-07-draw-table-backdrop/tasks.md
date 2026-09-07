## 1. Static Assets

- [x] 1.1 Add `table.avif` and `table.webp` to `apps/web/static/` (105KB avif, 127KB webp — both under 200KB)

## 2. Background Image

- [x] 2.1 Replace the flat `bg-[#f4ecde]` background and gradient overlay divs in `StudioDrawingPage.svelte` with a `<picture>` element using `<source type="image/avif" srcset="/table.avif">` and `<img src="/table.webp">`, absolutely positioned at `z-0`, `object-fit: cover`

## 3. Book Stage Positioning

- [x] 3.1 Define CSS custom properties `--book-offset-x`, `--book-offset-y`, and `--book-scale` on the page root container in `StudioDrawingPage.svelte` with initial tunable values
- [x] 3.2 Apply `transform: translate(var(--book-offset-x), var(--book-offset-y)) scale(var(--book-scale))` to the `.studio-book-frame` container so position tracks the custom properties

## 4. Quality Gates

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, `bun run test:unit` — all pass (no new failures)
