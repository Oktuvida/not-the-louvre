## ADDED Requirements

### Requirement: Post-it note displays room descriptions with handwriting aesthetic
The system SHALL render a post-it note component with a solid background color, clean rectangular edges (no ragged/torn effects), optional subtle corner curl, and text in handwriting font (Caveat), replacing the plain bordered card used for room descriptions.

#### Scenario: Post-it renders room description
- **WHEN** a gallery room's description is displayed
- **THEN** the description appears on a post-it note with the room's designated post-it color and Caveat font

#### Scenario: Post-it has clean edges
- **WHEN** a post-it note renders
- **THEN** the edges are clean rectangles with no ragged or torn effects

### Requirement: Post-it note color is per-room
The system SHALL use a designated post-it color for each gallery room: yellow for Hall of Fame, pink for Hot Wall, blue for Mystery, green for Your Studio.

#### Scenario: Hall of Fame post-it is yellow
- **WHEN** a post-it renders for the Hall of Fame room
- **THEN** the post-it background is yellow

#### Scenario: Your Studio post-it is green
- **WHEN** a post-it renders for the Your Studio room
- **THEN** the post-it background is green

### Requirement: Post-it note has deterministic attachment variant
The system SHALL display a tape or pin attachment on each post-it, with the attachment type determined by the room configuration.

#### Scenario: Tape attachment on post-it
- **WHEN** a post-it renders with tape attachment configured
- **THEN** a semi-transparent tape strip is visible attaching the note to the wall

#### Scenario: Pin attachment on post-it
- **WHEN** a post-it renders with pin attachment configured
- **THEN** a pushpin graphic is visible at the top of the note

### Requirement: Post-it note has slight rotation for natural appearance
The system SHALL apply a small rotation angle to each post-it note to simulate a hand-placed appearance. The rotation is deterministic from the room ID.

#### Scenario: Post-it appears slightly tilted
- **WHEN** a post-it note renders
- **THEN** it has a slight rotation (between -4 and +4 degrees) that looks naturally placed

### Requirement: Post-it can be placed anywhere on the page
The system SHALL allow post-it notes to be positioned freely on the page to create a natural, hand-placed appearance rather than being confined to rigid grid layouts.

#### Scenario: Post-it position varies per room
- **WHEN** post-it notes render for different rooms
- **THEN** each post-it can be positioned at different locations on the page to look naturally placed
