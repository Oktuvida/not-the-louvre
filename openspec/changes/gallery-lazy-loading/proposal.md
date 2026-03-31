## Why

The gallery route already benefits from SvelteKit route-level code splitting, but the gallery experience still eagerly loads most room UI and artwork media once the user enters `/gallery`. That increases initial route cost and wastes bandwidth on offscreen or unopened content, especially in image-heavy rooms.

## What Changes

- Add explicit lazy loading behavior for gallery artwork media so offscreen gallery images are deferred until the browser is near them.
- Defer non-primary gallery detail work so artwork detail payloads continue loading only when a visitor opens a piece.
- Split room-specific gallery UI behind on-demand loading boundaries so rooms that are not being viewed do not have to ship in the first gallery render.
- Preserve current gallery room behavior, navigation, moderation visibility rules, and empty states while improving loading strategy.
- Add route, component, and browser-level coverage that proves lazy loading does not break gallery rendering or artwork selection.

## Capabilities

### New Capabilities
- `gallery-lazy-loading`: The gallery loads artwork media and room-specific UI progressively so the first gallery render avoids unnecessary payload and offscreen work.

### Modified Capabilities

## Impact

- Affected code: `apps/web/src/lib/features/gallery-exploration/GalleryExplorationPage.svelte`, room components under `apps/web/src/lib/features/gallery-exploration/rooms/`, and artwork card components such as `ArtworkCard.svelte` and `PolaroidCard.svelte`.
- Affected behavior: gallery route startup cost, image loading behavior, room-specific bundle composition, and regression coverage for gallery interaction.
- Dependencies: existing gallery route server loads, current artwork detail API routes, and SvelteKit route-level code splitting that remains unchanged.
