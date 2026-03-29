## MODIFIED Requirements

### Requirement: Hall of Fame podium uses metallic frames and wax seal medals
The Hall of Fame podium SHALL render the top-3 artworks with metallic canvas frames (gold for 1st, silver for 2nd, bronze for 3rd) and wax seal medal components replacing the emoji medals. The podium layout structure (center elevated, flanking positions lower) is preserved.

#### Scenario: Podium top-3 have metallic frames
- **WHEN** the Hall of Fame room renders with at least 3 artworks
- **THEN** positions 1–3 display canvas-rendered frames with gold, silver, and bronze color schemes respectively

#### Scenario: Podium medals are wax seals not emojis
- **WHEN** the Hall of Fame podium renders
- **THEN** wax seal medal components are displayed above each podium frame instead of emoji medals

### Requirement: Hall of Fame non-podium artworks use polaroid cards
The Hall of Fame room SHALL render artworks ranked 4th and below as polaroid cards with rank badges, replacing the previous framed card grid.

#### Scenario: Non-podium artworks render as polaroids
- **WHEN** the Hall of Fame room has more than 3 artworks
- **THEN** artworks ranked 4th and below are displayed as polaroid cards with their rank number shown as a badge

### Requirement: Hot Wall artworks use polaroid cards
The Hot Wall room SHALL render all artworks as polaroid cards with deterministic tape or pin attachments.

#### Scenario: Hot Wall grid shows polaroids
- **WHEN** the Hot Wall room renders
- **THEN** all artworks are displayed as polaroid cards, not framed artwork cards

### Requirement: Your Studio artworks use polaroid cards
Your Studio SHALL render all artworks as polaroid cards with deterministic tape or pin attachments.

#### Scenario: Your Studio grid shows polaroids
- **WHEN** Your Studio renders
- **THEN** all artworks are displayed as polaroid cards, not framed artwork cards

### Requirement: Room descriptions use post-it notes
Each gallery room SHALL display its description text inside a post-it note component with the room's designated color, replacing the plain bordered description card.

#### Scenario: Room description is a post-it
- **WHEN** a gallery room renders its description
- **THEN** the description appears on a colored post-it note component instead of a plain card

### Requirement: Gallery title uses brass plaque
The gallery page SHALL display its title inside a brass plaque component, replacing the plain text heading.

#### Scenario: Gallery title is a brass plaque
- **WHEN** the gallery page renders
- **THEN** the page title is displayed inside a brass plaque with metallic gradient and engraved text
