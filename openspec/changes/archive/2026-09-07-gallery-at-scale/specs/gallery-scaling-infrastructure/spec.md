## ADDED Requirements

### Requirement: Gallery images SHALL declare intrinsic dimensions
All gallery artwork images SHALL render with explicit `width` and `height`
attributes matching the artwork's actual pixel dimensions (768x768) to
eliminate cumulative layout shift.

#### Scenario: PolaroidCard renders image with dimensions
- **WHEN** a PolaroidCard renders an artwork image
- **THEN** the `<img>` element SHALL have `width="768"` and `height="768"` attributes

#### Scenario: FilmReel renders frames with dimensions
- **WHEN** a FilmReel frame renders an artwork image
- **THEN** the `<img>` element SHALL have `width` and `height` attributes matching the frame size

### Requirement: Overscan rows SHALL use content-visibility containment
Row wrapper elements in virtualized grids SHALL apply `content-visibility: auto`
so that overscan rows skip paint until they enter the viewport.

#### Scenario: Overscan row skips paint
- **WHEN** a VirtualizedGrid renders a row outside the visible viewport (in the overscan zone)
- **THEN** the row wrapper element SHALL have `content-visibility: auto` and a `contain-intrinsic-size` value

#### Scenario: Visible row paints normally
- **WHEN** a VirtualizedGrid row enters the visible viewport
- **THEN** the browser SHALL paint the row and its child cards normally

### Requirement: Each gallery room SHALL own its accumulator state
Each room component SHALL create and manage its own accumulator instance.
When a room unmounts, its accumulator state SHALL be cleaned up. No
cross-room state leakage SHALL occur.

#### Scenario: Room creates accumulator on mount
- **WHEN** a gallery room component mounts
- **THEN** it SHALL create its own accumulator instance seeded with SSR data via `reseed()`

#### Scenario: Room cleans up on unmount
- **WHEN** a user navigates away from a gallery room
- **THEN** the room's accumulator state SHALL be released (no lingering references)

#### Scenario: Room navigation does not leak state
- **WHEN** a user navigates from Hall of Fame to Your Studio
- **THEN** Your Studio SHALL have its own independent accumulator, unaffected by Hall of Fame's prior state

### Requirement: VirtualizedGrid SHALL support responsive column counts
The `VirtualizedGrid` component SHALL accept configurable column breakpoints
and render the appropriate number of columns per row based on viewport width.

#### Scenario: Mobile viewport renders single column
- **WHEN** the viewport width is below the tablet breakpoint
- **THEN** VirtualizedGrid SHALL render 1 artwork per row

#### Scenario: Desktop viewport renders maximum columns
- **WHEN** the viewport width is at or above the desktop breakpoint
- **THEN** VirtualizedGrid SHALL render the configured desktop column count (3 or 4) per row

### Requirement: GalleryExplorationPage SHALL act as a room router
After decomposition, `GalleryExplorationPage.svelte` SHALL be a thin router
(~200 lines) that switches between room components based on `roomId` and
handles shared layout (header, background, detail panel overlay).

#### Scenario: Room routing renders correct component
- **WHEN** the gallery page loads with `roomId = "hall-of-fame"`
- **THEN** the page SHALL render the `HallOfFameRoom` component

#### Scenario: Shared layout persists across room navigation
- **WHEN** a user navigates between rooms
- **THEN** the gallery header, navigation, and detail panel overlay SHALL remain mounted
