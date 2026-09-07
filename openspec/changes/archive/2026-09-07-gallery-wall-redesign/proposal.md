## Why

The 3D home scene features a wall with the user's top 11 artworks in frames, but clicking "Gallery" navigates abruptly to a visually disconnected page. The gallery's "Your Studio" room uses the same layout as other rooms (grid of PolaroidCards on a parchment background) with no visual link back to the 3D studio the user just came from. The double cork-bar navigation eats vertical space and doesn't match the immersive gallery aesthetic. This change creates a cohesive visual narrative: 3D studio wall → animated transition → HTML gallery that feels like the same space.

## What Changes

- **GALLERY button destination**: Changes from `/gallery` (Hall of Fame) to `/gallery/your-studio`, since the 3D wall shows the user's own works
- **Home → Gallery transition**: GSAP camera animation zooms toward the wall, a full-screen fade overlay (matching the wall's gray) covers the screen, then SvelteKit navigates during the fade
- **Your Studio background**: Replaces parchment background image with a flat gray matching the 3D wall color; floating particles removed for this room only
- **Your Studio layout**: PolaroidCards use a scattered/staggered grid with deterministic vertical offsets (derived from artwork ID), replacing the uniform 3-column grid
- **Artwork limit removed**: Your Studio no longer caps at 12 artworks; all published works are displayed with scroll
- **Gallery navigation redesign**: Double cork-bar nav replaced with floating elements — back and Create Art buttons in top corners, sticker-style (GameLink) room tabs floating below
- **Room transitions**: Switching rooms uses a lateral slide animation instead of a full page reload feel
- Other rooms (Hall of Fame, Hot Wall, Mystery) retain their current parchment background and particle effects

## Capabilities

### New Capabilities
- `gallery-entry-transition`: Camera zoom animation on home page + fade overlay + programmatic navigation to gallery. Covers the GSAP timeline, fade overlay component, and goto() coordination.
- `gallery-navigation-layout`: Floating navigation replacing the double cork-bar. Covers the sticker-tab room nav, corner-positioned action buttons, and per-room background/particle conditions.
- `gallery-studio-wall`: Your Studio-specific wall layout with scattered PolaroidCards, gray background, and unlimited scroll. Covers the staggered grid, deterministic scatter offsets, and removal of the 12-artwork cap.
- `gallery-room-transitions`: Lateral slide animation when switching between gallery rooms.

### Modified Capabilities
<!-- No existing spec-level requirements change. Artwork discovery data flow and sorting remain identical. The 12-item limit is a UI-layer filter in the route loader, not a spec-level requirement. -->

## Impact

- **Home page**: `PersistentNav.svelte` — href change + GSAP animation + fade overlay
- **Gallery page**: `GalleryExplorationPage.svelte` — conditional background/particles per room, nav layout overhaul, Your Studio layout change
- **Gallery nav**: `GalleryRoomNav.svelte` — replace cork-bar tabs with floating sticker GameLinks
- **Server data**: `gallery-data.server.ts` — remove `.slice(0, 12)` limit for your-studio
- **New components**: FadeOverlay (home page transition), possibly RoomSlideTransition wrapper
- **No backend/API/DB changes**: All changes are frontend presentation layer
- **No model/GLB changes**: 3D scene is unmodified
