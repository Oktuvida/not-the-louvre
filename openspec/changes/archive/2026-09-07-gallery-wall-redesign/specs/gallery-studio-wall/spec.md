## ADDED Requirements

### Requirement: Your Studio uses gray wall background
The system SHALL render the Your Studio room with a flat gray background color (approximately `#6e6e6e`) without the parchment background image or floating particles.

#### Scenario: Your Studio background differs from other rooms
- **WHEN** the user is viewing the Your Studio room
- **THEN** the background SHALL be a solid gray color matching the 3D wall aesthetic
- **AND** the parchment background image (`gallery-bg.webp`) SHALL NOT be displayed
- **AND** floating gold particles SHALL NOT be rendered

#### Scenario: Other rooms retain current background
- **WHEN** the user is viewing Hall of Fame, Hot Wall, or Mystery rooms
- **THEN** the parchment background image and floating particles SHALL remain unchanged

### Requirement: Your Studio displays all published artworks with scroll
The system SHALL display all of the user's published artworks in the Your Studio room without a hard cap, allowing vertical scroll.

#### Scenario: User has more than 12 artworks
- **WHEN** a user has more than 12 published artworks
- **THEN** all artworks SHALL be visible by scrolling vertically
- **AND** no arbitrary limit SHALL truncate the list

#### Scenario: User has zero artworks
- **WHEN** a user has no published artworks
- **THEN** the Your Studio room SHALL display an appropriate empty state

### Requirement: PolaroidCards use scattered layout
The system SHALL display PolaroidCards with a deterministic scatter effect that makes the grid feel organic, like artworks pinned to a wall.

#### Scenario: Each card has a unique vertical offset
- **WHEN** PolaroidCards render in the Your Studio grid
- **THEN** each card SHALL have a small deterministic vertical offset (translateY) derived from its artwork ID
- **AND** the existing deterministic rotation per card SHALL be preserved

#### Scenario: Scatter is consistent across page loads
- **WHEN** the user revisits Your Studio
- **THEN** each card SHALL appear in the same scattered position as before (deterministic hash, not random)
