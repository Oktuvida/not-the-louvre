## ADDED Requirements

### Requirement: Gallery uses floating navigation layout
The system SHALL replace the double cork-bar navigation with floating navigation elements positioned over the gallery background.

#### Scenario: Back button position
- **WHEN** the gallery page renders
- **THEN** a back button (GameLink, ghost or secondary variant) SHALL appear in the top-left corner
- **AND** it SHALL link to the home page (`/`)

#### Scenario: Create Art button position
- **WHEN** the gallery page renders
- **THEN** a Create Art button (GameLink, primary variant) SHALL appear in the top-right corner
- **AND** it SHALL link to the draw page (`/draw`)

#### Scenario: Room tabs as floating sticker GameLinks
- **WHEN** the gallery page renders
- **THEN** room navigation tabs SHALL appear as GameLink components below the top buttons
- **AND** each tab SHALL use its room-specific variant (hall-of-fame: accent, hot-wall: danger, mystery: secondary, your-studio: primary)
- **AND** the active room tab SHALL be visually distinguished (scale, opacity, or similar)

### Requirement: Navigation adapts to viewport
The system SHALL ensure the floating navigation remains usable on all supported viewport sizes.

#### Scenario: Narrow viewport room tabs
- **WHEN** the viewport is narrower than the total width of all room tabs
- **THEN** the room tabs SHALL be horizontally scrollable

#### Scenario: Navigation does not obscure artwork content
- **WHEN** the user scrolls through artworks
- **THEN** the navigation elements SHALL remain accessible (sticky or fixed positioning)
- **AND** they SHALL NOT permanently obscure artwork content
