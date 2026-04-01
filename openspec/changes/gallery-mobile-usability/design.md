## Context

The current homepage and gallery UI lean heavily on desktop spacing and large decorative elements. On narrow mobile viewports, the homepage persistent preview stack competes with the primary controls, and the gallery shell combines sticky actions, room navigation, room notes, and large content modules in a way that can feel crowded. The Mystery room is also tuned for a wide horizontal reel, with `FilmReel.svelte` calculating layout and animation entirely from the horizontal axis.

This change is intentionally narrower than a full responsive redesign. The goal is to make the experience usable on mobile without rethinking every gallery surface or introducing new layouts that would increase implementation risk.

### Current state

- `PersistentNav.svelte` renders the top-artwork preview stack as an absolutely positioned right-side column regardless of viewport width.
- `GalleryExplorationPage.svelte` uses desktop-leaning padding and sticky header spacing on all viewports, with room notes and controls layered around the main content.
- `GalleryRoomNav.svelte` already supports horizontal overflow, which is a good baseline for mobile.
- `MysteryRoom.svelte` adds large vertical spacing (`pt-55`, `gap-16`) and a large hero button around the reel.
- `FilmReel.svelte` is fully horizontal by design: slot calculation, centering, and spin animation all depend on `offsetWidth`, `x` positioning, and a 256px frame size.

### Constraints

- This is a usability pass, not full responsiveness across every gallery surface.
- Mystery should remain horizontally oriented on mobile for this change.
- No backend, API, routing, or schema changes.
- Desktop behavior should remain visually consistent unless a shared simplification is required.

## Goals / Non-Goals

**Goals:**

- Reduce mobile clutter on the homepage by removing non-essential decorative preview content.
- Make the gallery shell more comfortable on narrow screens by tightening spacing and allowing controls to fit naturally.
- Preserve the Mystery room's horizontal identity while making the reel and supporting UI fit small viewports better.
- Keep the implementation localized to existing gallery and homepage components.

**Non-Goals:**

- Reworking the Mystery room into a vertical reel.
- Rebuilding the Hall of Fame podium specifically for mobile in this change.
- Achieving pixel-perfect responsiveness for every gallery breakpoint.
- Changing gallery behavior, ranking logic, or discovery data contracts.

## Decisions

### D1: Hide the homepage top-artwork preview stack on narrow mobile viewports

**Decision:** Treat the top-artwork preview stack in `PersistentNav.svelte` as decorative content and hide it below the first mobile breakpoint instead of resizing and preserving it.

**Rationale:** This is the cleanest way to reduce crowding around the homepage CTA and avatar/logout controls. The preview stack is not required for navigation or task completion, so removing it on mobile improves usability without affecting core flow.

**Alternative considered:** Keep the stack and shrink the frames. Rejected because the absolute positioning and surrounding note already consume meaningful mobile real estate, and a smaller stack would still compete with primary controls.

### D2: Adjust the gallery shell with breakpoint-specific spacing rather than structural rewrites

**Decision:** Make the gallery shell more mobile-friendly by reducing container padding, tightening sticky header offsets, and letting surrounding decorative content breathe within the existing layout instead of restructuring the page.

**Rationale:** `GalleryExplorationPage.svelte` already separates shell concerns from room content. Small breakpoint-specific spacing changes can improve readability and reduce collisions without rewriting navigation or room composition.

**Alternative considered:** Introduce a separate mobile gallery shell. Rejected because it would duplicate logic and increase risk across all rooms for a narrow usability pass.

### D3: Keep Mystery horizontal and make the reel itself responsive

**Decision:** Preserve the horizontal reel model in `FilmReel.svelte`, but scale its viewport and frame sizing down for narrow screens while keeping the same slot logic and horizontal spin behavior.

**Rationale:** The current reel logic is already horizontally specialized. Adapting frame size, viewport height, and surrounding spacing is a much smaller and safer change than rotating the reel to a vertical axis. This keeps the room's identity intact and avoids touching the fundamental animation model.

**Alternative considered:** Convert the reel to a vertical motion model on mobile. Rejected for this change because it would require a second positioning and animation path (`offsetHeight`, `y`, `centerY`) and introduce substantially more implementation and testing risk.

### D4: Tighten Mystery room chrome around the reel on mobile

**Decision:** Reduce the Mystery room's top padding, gaps, and hero control footprint on narrow screens so the reel remains the focal point without pushing essential controls too far below the fold.

**Rationale:** The reel is not the only mobile pressure point; the surrounding spacing and call-to-action size also affect usability. Coordinating these mobile reductions keeps the room balanced without redesigning its composition.

**Alternative considered:** Change only the reel dimensions. Rejected because the current container spacing would still make the room feel oversized even if the reel itself became smaller.

## Risks / Trade-offs

- **[Hall of Fame remains desktop-leaning on mobile]** -> Mitigation: this change targets the homepage, gallery shell, and Mystery room first; the Hall of Fame podium can be handled in a follow-up if mobile testing shows it still blocks usability.
- **[Responsive reel tuning may affect visual drama]** -> Mitigation: preserve the same horizontal interaction model and center focus while only reducing scale on narrow screens.
- **[Sticky gallery controls may still feel dense on the smallest phones]** -> Mitigation: prioritize spacing and wrapping behavior in the shell changes and verify on narrow viewport sizes during implementation.

## Migration Plan

- No migration steps are required.
- Changes are frontend-only and can be rolled back by reverting the affected Svelte component updates.

## Open Questions

None. The scope is intentionally constrained around a horizontal-first mobile pass for Mystery and minimal mobile usability improvements elsewhere.
