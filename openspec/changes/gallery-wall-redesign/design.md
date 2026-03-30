## Context

The home page renders a 3D Threlte scene (`StudioScene.svelte`) with an orthographic camera at `[0, 7.8, 16]`, zoom `40`, model rotated -45° via GSAP. The model includes 11 named mesh slots (`a1`-`a11`) that receive artwork textures through `SceneTextureBindings.svelte`. A "GALLERY" GameLink in `PersistentNav.svelte` navigates to `/gallery`.

The gallery page (`GalleryExplorationPage.svelte`) has four rooms. It uses a parchment background (`#e7dece` + `gallery-bg.webp`), floating gold particles, and a double cork-bar navigation (top bar with back/title/create-art, second bar with room tabs as GameLinks). "Your Studio" displays the user's artworks as PolaroidCards in a 3-column grid, capped at 12 items via `gallery-data.server.ts`.

The existing GSAP animation infrastructure is mature — the `MuseumWallOverlay` already implements a complex zoom-through transition with multi-stage timelines and state machine coordination.

## Goals / Non-Goals

**Goals:**
- Create a visual narrative from the 3D studio wall to the gallery's "Your Studio" room
- Replace the double cork-bar with lighter, floating navigation that doesn't consume 8.5rem of vertical space
- Give "Your Studio" its own visual identity (gray wall background) distinct from other rooms
- Remove the 12-artwork cap so users can scroll through all their published works
- Add visual interest to the PolaroidCard grid with deterministic scatter

**Non-Goals:**
- Pixel-perfect match between 3D wall and HTML layout (the fade transition intentionally breaks this coupling)
- Changing the 3D model (GLB) or its texture bindings
- Redesigning other gallery rooms (Hall of Fame, Hot Wall, Mystery keep their current look)
- Adding pagination or infinite scroll — all artworks load at once (acceptable given the current discovery query already returns all user works)
- Responsive breakpoint changes beyond what the existing grid already handles

## Decisions

### 1. Fade-through transition instead of direct 3D→HTML match

**Choice:** Camera animates toward the wall while a solid-color overlay fades in, navigation happens during the fade, gallery page fades in from the same color.

**Alternatives considered:**
- *Direct match (3D canvas → HTML)*: Requires extracting exact frame positions from GLB and pixel-perfect CSS replication. High risk of visual mismatch, brittle to model changes.
- *View Transitions API*: SvelteKit supports it, but morphing a WebGL canvas into DOM elements is unreliable across browsers.
- *No page navigation (overlay)*: Keeps everything on `/`, avoids route transition entirely. More control but couples gallery rendering to the home page, complicating code organization and deep-linking.

**Rationale:** Fade-through is the lowest risk with the highest perceived quality. The color bridge makes the transition feel intentional. The camera animation adds cinematic weight without requiring layout matching.

### 2. GALLERY button targets `/gallery/your-studio`

**Choice:** The home page GALLERY link navigates to Your Studio instead of Hall of Fame.

**Rationale:** The 3D wall displays the user's own artworks. Navigating to someone else's works (Hall of Fame) creates a narrative disconnect. Your Studio is the natural continuation.

### 3. Sticker-style GameLinks for room tabs (not post-it tabs)

**Choice:** Reuse the existing `GameLink` component with room-specific variants for navigation tabs, positioned as floating elements.

**Alternatives considered:**
- *PostItNote tabs*: Already designed in `detail-postit-notes.html` with room colors. But introduces a third control style alongside GameLink and BrassPlaque.
- *BrassPlaque tabs*: Museum-authentic but too heavy for tab navigation.

**Rationale:** GameLink already maps room → variant (`hall-of-fame: accent`, `hot-wall: danger`, `mystery: secondary`, `your-studio: primary`). Reusing it means no new component, consistent interaction patterns, and the sticker aesthetic fits the playful museum theme.

### 4. Scattered PolaroidCard grid via deterministic transforms

**Choice:** Use CSS grid with a deterministic `translateY` offset per card, derived from artwork ID hash (same pattern as existing rotation).

**Implementation approach:**
```
const seed = hashCode(artwork.id);
const rotation = (seed % 7) - 3;       // existing: -3° to +3°
const offsetY = ((seed >> 4) % 21) - 10; // new: -10px to +10px
```

**Alternatives considered:**
- *Absolute positioning replicating GLB*: Requires extracting mesh coordinates, fragile, doesn't scale beyond 11 items.
- *CSS masonry*: PolaroidCards are same-height, so masonry has no visual effect.
- *Staggered rows (brick pattern)*: Offset every other row by half a card width. Considered but less organic than per-card scatter.

**Rationale:** Per-card scatter with the existing rotation creates a "pinned to a wall" feeling with zero layout complexity. It's a CSS grid with transforms — simple, responsive, performant.

### 5. Per-room background conditioning

**Choice:** `GalleryExplorationPage` conditionally applies background styles based on `roomId`:
- `your-studio`: flat gray (approximately `#6e6e6e`, to be tuned visually), no background image, no floating particles
- All other rooms: current parchment background + particles unchanged

**Rationale:** Keeps scope minimal. Other rooms are untouched. The gray provides visual contrast that makes PolaroidCards pop and connects to the 3D wall feel.

### 6. Floating navigation layout

**Choice:** Remove both cork bars. Replace with:
- **Top-left:** Back button (GameLink ghost/secondary, small)
- **Top-right:** Create Art button (GameLink primary, small)
- **Below top buttons:** Room tabs (GameLink row, centered, floating)
- All elements use `position: sticky` or fixed, with appropriate z-index

**Rationale:** Frees vertical space. Navigation elements float over the background, feeling "mounted" on the wall rather than enclosed in a bar.

### 7. Lateral slide transition between rooms

**Choice:** When switching rooms, content slides left/right based on room order in the `galleryRooms` array.

**Implementation:** CSS transition on a wrapper div with `transform: translateX()`. Direction determined by comparing old room index to new room index.

**Alternatives considered:**
- *Full page reload*: Current behavior, jarring
- *Fade*: Simple but doesn't communicate spatial relationship between rooms
- *No animation*: Simplest, but misses the "walking through a museum" metaphor

**Rationale:** Lateral slide communicates that rooms are adjacent spaces. Combined with the new floating nav, it reinforces the museum-walk feeling.

## Risks / Trade-offs

**[Risk] GSAP animation timing on home page conflicts with SvelteKit navigation** → The `goto()` call must happen after the fade overlay fully covers the screen. Use GSAP `onComplete` callback to trigger navigation. If navigation is slow (server load), the overlay stays visible until the gallery page mounts and triggers its fade-in.

**[Risk] Gray background color mismatch with 3D wall** → The GLB material color can't be read at runtime from a screenshot. We'll approximate (~`#6e6e6e`) and tune visually. The fade transition makes an exact match unnecessary.

**[Risk] Loading all artworks without pagination** → For a user with 200+ artworks, this could mean a heavy page. Mitigation: artwork images already lazy-load. Monitor and add pagination later if needed. Current max in production is unlikely to exceed 50-100 per user.

**[Risk] Floating nav overlaps artwork content on small screens** → The nav needs careful z-indexing and possibly reduced padding/margins on mobile. Room tabs may need horizontal scroll on narrow viewports (they already use `overflow-x-auto`).

**[Risk] Lateral slide transition complexity** → Need to handle rapid room switching (user clicking tabs quickly). Mitigation: debounce or cancel in-progress transitions when a new room is selected.

**[Trade-off] Your Studio visual break from other rooms** → Having one room look completely different could feel inconsistent. Accepted because Your Studio is conceptually distinct ("your space" vs "public gallery") and the transition between rooms will use a slide animation that bridges the visual gap.
