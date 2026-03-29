## ADDED Requirements

### Requirement: Wax seal medal replaces emoji medals for podium positions
The system SHALL render CSS-based wax seal medal components in place of emoji medals (`🥇🥈🥉`) for artworks in podium positions 1–3.

#### Scenario: Gold wax seal for first place
- **WHEN** an artwork is in podium position 1
- **THEN** a gold-colored wax seal medal with scalloped edges is displayed

#### Scenario: Silver wax seal for second place
- **WHEN** an artwork is in podium position 2
- **THEN** a silver-colored wax seal medal with scalloped edges is displayed

#### Scenario: Bronze wax seal for third place
- **WHEN** an artwork is in podium position 3
- **THEN** a bronze-colored wax seal medal with scalloped edges is displayed

### Requirement: Wax seal medal supports three sizes
The system SHALL support three medal sizes (small, medium, large) to accommodate different display contexts — large for podium centerpiece, medium for podium flanks, small for inline rank indicators.

#### Scenario: Large medal on podium center
- **WHEN** a wax seal medal renders in large size
- **THEN** the medal is visually prominent, suitable for the first-place podium position

#### Scenario: Small medal for inline use
- **WHEN** a wax seal medal renders in small size
- **THEN** the medal is compact, suitable for inline display next to text or in card headers

### Requirement: Wax seal medal displays position number
The system SHALL display the podium position number (1, 2, or 3) embossed in the center of the wax seal.

#### Scenario: Number is visible in seal center
- **WHEN** a wax seal medal renders for position 2
- **THEN** the number "2" is displayed in the center of the seal with an embossed appearance

### Requirement: Wax seal medals do not animate
The system SHALL render wax seal medals without the `animate-pulse` or `animate-spin` animations used by the current emoji medals.

#### Scenario: Medals are static
- **WHEN** wax seal medals render on the podium
- **THEN** no CSS animations are applied to the medals
