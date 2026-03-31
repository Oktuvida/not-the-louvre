## Why

The transition from the home 3D scene to the draw page currently lands on a flat `#f4ecde` background, breaking the visual continuity of the top-close camera animation. By using a static image (`table.avif`/`table.webp`) that matches the final frame of the 3D top-close camera pose as the draw page background, the user perceives a seamless transition from the 3D studio table into the drawing workspace. The sketchbook position also needs to be adjustable so it can be aligned with the table image, reinforcing the illusion of sitting at the studio desk.

## What Changes

- Replace the draw page's solid background color with `table.avif` (primary) and `table.webp` (fallback) as a full-bleed background image.
- Reposition the sketchbook/book stage so its placement on screen aligns with the table surface in the background image, creating visual continuity with the 3D scene's top-close pose.
- Extract book positioning values (offsets, scale) into easily tunable constants so they can be adjusted manually without digging through layout code.

## Capabilities

### New Capabilities
- `draw-table-backdrop`: Background image setup for the draw page with the table photograph, responsive sizing, format fallback (`avif` → `webp`), and tunable book stage positioning.

### Modified Capabilities

## Impact

- `StudioDrawingPage.svelte` — background and book stage layout changes.
- `apps/web/static/` — new static image assets (`table.avif`, `table.webp`) need to be added.
- No API, database, or dependency changes.
