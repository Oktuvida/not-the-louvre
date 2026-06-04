# gallery-layout-persistence Specification

## Purpose
Prevent full-route teardown and preserve continuity across gallery room navigation.

## Requirements

### Requirement: Shared gallery layout
The `/gallery/+layout.svelte` SHALL persist `GalleryRoomNav`, header, and `ArtworkDetailPanel` across subroute changes while replacing only the room content area.

#### Scenario: Room switch without blank flash
- GIVEN the user is on any gallery room
- WHEN they select a different room via navigation
- THEN the shell UI remains mounted
- AND the room content updates without a blank flash

#### Scenario: Scroll position preserved
- GIVEN the user has scrolled down a gallery room
- WHEN they navigate away and then back to that room
- THEN the previous scroll position is preserved

### Requirement: Preload room data on hover
Gallery room navigation links SHOULD use `data-sveltekit-preload-data="hover"` to fetch route data before the user clicks.

#### Scenario: Hover preloads room
- GIVEN a room nav link is rendered
- WHEN the user hovers over that link
- THEN the target room data begins preloading

### Requirement: Gallery entry animation timing
GSAP entry animations for gallery room content MUST use a fade duration of at most 250ms and an initial delay of 0ms.

#### Scenario: Room content appears quickly
- GIVEN a gallery room is transitioning in
- WHEN its GSAP entry animation begins
- THEN the fade duration is ≤ 250ms
- AND the delay before starting is 0ms
