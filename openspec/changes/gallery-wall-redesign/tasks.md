## 1. Gallery Navigation Redesign

- [x] 1.1 Remove the double cork-bar markup and CSS from `GalleryExplorationPage.svelte` (both `.cork-bar` containers, associated styles, and the `BrassPlaque` title)
- [x] 1.2 Add floating back button (GameLink, ghost/secondary, small) positioned top-left with appropriate z-index and sticky/fixed behavior
- [x] 1.3 Add floating Create Art button (GameLink, primary, small) positioned top-right matching the back button's positioning strategy
- [x] 1.4 Refactor `GalleryRoomNav.svelte` to render GameLink tabs as a centered floating row below the top buttons (remove cork-bar wrapper, keep room variant mapping and `overflow-x-auto` for narrow viewports)
- [x] 1.5 Verify navigation layout on mobile and desktop breakpoints — tabs scrollable on narrow screens, buttons don't obscure content

## 2. Your Studio Background and Particles

- [x] 2.1 Add conditional background logic in `GalleryExplorationPage.svelte`: if `roomId === 'your-studio'`, apply flat gray background (start with `#6e6e6e`) and remove `background-image`; otherwise keep parchment + `gallery-bg.webp`
- [x] 2.2 Conditionally skip rendering the floating particle overlay when `roomId === 'your-studio'`
- [x] 2.3 Visually tune the gray value to feel cohesive with PolaroidCard colors and the floating nav elements

## 3. Your Studio Scattered Layout

- [x] 3.1 In `gallery-data.server.ts`, remove the `.slice(0, 12)` cap for the `your-studio` room so all published artworks are returned
- [x] 3.2 Add a deterministic `translateY` offset to the PolaroidCard rendering in the Your Studio grid (derive from artwork ID hash, range approximately -10px to +10px), alongside the existing rotation
- [x] 3.3 Verify the scattered grid renders correctly with 0, 1, 5, 11, and 20+ artworks
- [x] 3.4 Ensure the empty state for Your Studio (zero artworks) displays an appropriate message

## 4. Home-to-Gallery Entry Transition

- [x] 4.1 Change the GALLERY button `href` in `PersistentNav.svelte` from `/gallery` to `/gallery/your-studio`
- [x] 4.2 Create a FadeOverlay component — a full-screen absolutely positioned div that can animate opacity from 0 to 1 using GSAP, using the wall gray color as background
- [x] 4.3 Intercept the GALLERY link click in `PersistentNav.svelte`: prevent default navigation, trigger a GSAP timeline that zooms the camera toward the wall and fades in the overlay simultaneously
- [x] 4.4 On GSAP timeline completion (`onComplete`), call `goto('/gallery/your-studio')` to perform the SvelteKit navigation
- [x] 4.5 On the gallery page, detect if arrival was from the home transition (e.g., via URL query param or navigation state) and play a fade-in animation from the wall gray; skip this animation for direct URL access or room-to-room navigation

## 5. Gallery Room Slide Transitions

- [x] 5.1 Determine slide direction by comparing the old room index to the new room index in the `galleryRooms` array
- [x] 5.2 Wrap room content in a transition container that applies `translateX` CSS transitions (slide out left/right for old content, slide in from right/left for new content)
- [x] 5.3 Handle rapid tab clicks — cancel or fast-forward in-progress transitions when a new room is selected before the current transition completes

## 6. Quality Gates

- [x] 6.1 Run `bun run format` and fix any formatting issues
- [x] 6.2 Run `bun run lint` and fix any lint errors (removed unused svelte-ignore comment in PersistentNav; 1 pre-existing error in ArtworkDetailPanel remains)
- [x] 6.3 Run `bun run check` and fix any type errors
- [x] 6.4 Run `bun run test:unit` and fix any failing unit tests (all pre-existing timeouts, no regressions from our changes)
- [x] 6.5 Run `bun run test:e2e` and fix any failing e2e tests (fixed strict mode violation for 'Hall of Fame' text; 2 pre-existing auth flow failures remain)
