## Why

The homepage and gallery were designed primarily around desktop proportions, which leaves key gallery surfaces cramped or visually overwhelming on narrow mobile viewports. We want a targeted usability pass now so mobile visitors can browse the gallery comfortably without committing to a full responsive redesign.

## What Changes

- Hide the homepage persistent top-artwork preview stack on narrow mobile viewports to reduce clutter and keep the primary CTA usable.
- Tighten the gallery shell on narrow mobile viewports so the sticky controls, room navigation, room note, and main content fit more comfortably.
- Keep the Mystery room horizontally oriented on mobile, but scale and space the reel so it remains readable and operable on small screens.
- Preserve desktop behavior and visuals as the baseline; mobile changes are scoped to usability, not a complete cross-breakpoint redesign.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `artwork-discovery`: gallery discovery surfaces and room presentations adapt for narrow mobile viewports so browsing remains usable without changing the underlying gallery flow.

## Impact

- **Components modified**: `PersistentNav.svelte`, `GalleryExplorationPage.svelte`, `GalleryRoomNav.svelte`, `MysteryRoom.svelte`, `FilmReel.svelte`
- **Tests likely affected**: homepage nav/component tests and gallery exploration room tests
- **No API changes, no schema changes, no backend changes**
