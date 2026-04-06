## ADDED Requirements

### Requirement: Gallery room discovery scope remains correct across room navigation
The system SHALL preserve each gallery room's discovery scope when the user navigates between rooms. Frontend continuation state and room transitions MUST NOT cause a room to render artworks from another room's discovery scope.

#### Scenario: Mystery room stays on public recent discovery
- **WHEN** a user navigates into `mystery` from any other gallery room
- **THEN** the mystery room renders artworks from the public recent-discovery scope defined for mystery, regardless of what was loaded in the previous room

#### Scenario: Your studio stays viewer-scoped
- **WHEN** a signed-in user navigates into `your-studio` from any public gallery room
- **THEN** the studio room renders only the signed-in viewer's published artworks and excludes artworks owned by other users

#### Scenario: Hall of fame stays ranked and public
- **WHEN** a user navigates into `hall-of-fame` after visiting another gallery room
- **THEN** the hall-of-fame room renders the ranked public discovery scope defined for that room rather than any previously buffered room dataset
