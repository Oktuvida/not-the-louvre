## Why

The home route currently feels blocked by a Studio loading screen while the transformed GLB is still loading, and gallery artwork detail does not cooperate with browser back on mobile. Together these issues make the product feel unavailable on slower devices and make gallery navigation frustrating once a visitor opens a piece.

## What Changes

- Replace the blocking home-scene loading screen with a progressive, in-place fallback that keeps the root page usable while the transformed GLB loads or fails.
- Treat gallery artwork detail opened from a room as local overlay history so browser back closes the detail before leaving the current room.
- Preserve normal browser-history behavior for gallery detail states that did not originate from selecting artwork inside the current room.
- Add component and browser coverage for progressive entry rendering and gallery back-navigation behavior.

## Capabilities

### New Capabilities
- `home-entry-progressive-scene-loading`: The home entry route renders immediately and treats the Studio GLB as progressive scene media instead of a blocking prerequisite.
- `gallery-artwork-history-navigation`: Gallery artwork detail integrates with local browser history so back closes an in-room detail overlay before leaving the gallery room.

### Modified Capabilities

## Impact

- Affected code: `apps/web/src/lib/features/home-entry-scene/scene/StudioScene.svelte`, `apps/web/src/lib/features/shared-3d-world/components/StudioLoadingFallback.svelte`, `apps/web/src/lib/features/gallery-exploration/GalleryExplorationPage.svelte`, related artwork-detail components, and home/gallery tests.
- Affected behavior: root-page availability under slow or failed GLB loads, gallery detail close behavior, and mobile back-navigation expectations.
- Dependencies: existing home entry state machine, current gallery detail loading flow, and browser history behavior available through SvelteKit navigation utilities.