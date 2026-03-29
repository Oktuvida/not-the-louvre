## ADDED Requirements

### Requirement: Polaroid card displays artwork with casual pinned-to-wall aesthetic
The system SHALL render a polaroid-style card component with the artwork image in the main area, a white border simulating polaroid film, and a caption area at the bottom containing the artist's avatar and artwork title in handwriting font (Caveat).

#### Scenario: Polaroid card renders artwork with artist info
- **WHEN** a polaroid card is rendered for an artwork
- **THEN** the card displays the artwork image, the artist's avatar in the bottom caption area, and the artwork title in Caveat font

#### Scenario: Polaroid card avatar is in the caption area
- **WHEN** a polaroid card renders
- **THEN** the artist avatar appears within the white bottom caption strip, not floating on the image corner

### Requirement: Polaroid card attachment type is deterministic per artwork
The system SHALL select either a tape or pin attachment style for each polaroid card based on a hash of the artwork's ID, producing the same attachment for the same artwork on every render.

#### Scenario: Tape attachment renders adhesive strip
- **WHEN** a polaroid card's deterministic hash selects tape attachment
- **THEN** a semi-transparent tape strip is rendered across the top of the polaroid

#### Scenario: Pin attachment renders pushpin
- **WHEN** a polaroid card's deterministic hash selects pin attachment
- **THEN** a circular pushpin graphic is rendered at the top center of the polaroid

### Requirement: Polaroid card has deterministic slight rotation
The system SHALL apply a small rotation angle (between -3 and +3 degrees) to each polaroid card, determined by a hash of the artwork's ID, to create a natural pinned-to-wall appearance.

#### Scenario: Polaroid cards have varied rotations
- **WHEN** multiple polaroid cards render in a grid
- **THEN** each card has a unique slight rotation that remains the same across re-renders

### Requirement: Polaroid card supports optional rank badge
The system SHALL support an optional rank number displayed as a small badge on the polaroid card for ranked artwork contexts (e.g., Hall of Fame non-podium positions).

#### Scenario: Rank badge displays position number
- **WHEN** a polaroid card is rendered with a rank value
- **THEN** a small badge showing the rank number appears on the card

#### Scenario: No rank badge when rank is not provided
- **WHEN** a polaroid card is rendered without a rank value
- **THEN** no rank badge is displayed
