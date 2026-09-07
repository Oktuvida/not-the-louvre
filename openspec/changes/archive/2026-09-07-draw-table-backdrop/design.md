## Context

The draw page (`StudioDrawingPage.svelte`) currently uses a flat `bg-[#f4ecde]` with gradient overlays as its background. The home page has a new top-close camera animation that zooms into a bird's-eye view of the studio table before fading to gray and navigating to `/draw`. The disconnect between the 3D scene's final frame and the flat draw page background breaks the illusion of continuity.

The draw page layout uses a CSS grid with the book stage (`DrawingBookStage`) taking up most of the viewport via `clamp(29rem, 78vh, 56rem)` height, positioned inside a `max-w-[1600px]` centered container.

## Goals / Non-Goals

**Goals:**
- Replace the flat background with a photograph (`table.avif` / `table.webp`) that matches the top-close camera's final frame, creating visual continuity from the 3D transition.
- Make the book stage position tunable via clearly named CSS custom properties or constants so the book can be manually aligned to match the table in the image.
- Use `<picture>` with `<source>` for avif-first, webp-fallback.

**Non-Goals:**
- Responsive image variants (srcset / different crops per breakpoint) — single image, `object-fit: cover`.
- Animating the book into position on page load — static positioning only.
- Changing the DrawingBookStage component internals — only its container positioning changes.
- Changing the tool tray layout.

## Decisions

**1. Background image via `<picture>` element (not CSS `background-image`)**
Use an HTML `<picture>` element with `<source type="image/avif">` and `<img>` fallback. This gives native format negotiation without needing CSS `image-set()` (limited browser support). The image is absolutely positioned behind content (`z-0`, `object-fit: cover`, `object-position: center`).

Alternative considered: CSS `background-image` with `image-set()` — rejected because `image-set()` type negotiation has inconsistent browser support for avif.

**2. Book positioning via CSS custom properties on the page root**
Define custom properties on the root container for the book stage offset and scale:
```
--book-offset-x
--book-offset-y
--book-scale
```
These are applied to the book stage's container via `transform: translate(var(--book-offset-x), var(--book-offset-y)) scale(var(--book-scale))`. Values are declared at the top of the `<style>` block or as inline constants so they're trivial to find and edit.

Alternative considered: Svelte `$state` variables in `<script>` — rejected because these are purely visual positioning values with no runtime behavior; CSS custom properties are more appropriate and inspectable in dev tools.

**3. Remove existing gradient overlays**
The current radial/linear gradient overlays on the background were designed for the flat color. With the photograph as background, they would wash out the image. Remove them and let the table image provide the visual atmosphere directly.

## Risks / Trade-offs

- **[Image file size]** → Keep assets under ~200KB each. Avif typically compresses well for photographic content. The webp fallback may be larger.
- **[Book alignment precision]** → The custom property approach makes tuning fast (edit values, reload), but the alignment will be approximate since the 3D camera parameters and the photograph viewport don't have a mathematical relationship — manual visual tuning is required.
- **[Object-fit: cover cropping]** → On extreme aspect ratios the image may crop significantly. Acceptable trade-off given the image is atmosphere, not content.
