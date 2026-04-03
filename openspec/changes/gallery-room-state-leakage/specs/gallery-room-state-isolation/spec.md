## ADDED Requirements

### Requirement: Gallery room continuation state is isolated per room session
The system SHALL initialize gallery continuation state from the active room's route data and SHALL NOT reuse buffered artworks, pagination cursors, or continuation errors from a previously visited room.

#### Scenario: Entering mystery after visiting your studio
- **WHEN** a signed-in user visits `your-studio` and then navigates to `mystery`
- **THEN** the mystery room initializes from the mystery room's public discovery seed instead of the viewer-scoped studio buffer

#### Scenario: Entering your studio after visiting a public room
- **WHEN** a signed-in user visits `hall-of-fame` or `mystery` and then navigates to `your-studio`
- **THEN** the studio room initializes from the current viewer-scoped studio seed and excludes artworks authored by other users

#### Scenario: Room-specific continuation state does not leak across navigation
- **WHEN** a user navigates from one gallery room to another after loading additional pages or encountering a continuation error
- **THEN** the destination room starts with its own initial buffered artworks, cursor state, and continuation error state

### Requirement: Scroll continuation feedback preserves visual continuity
The system SHALL present append-style gallery loading in a way that reduces visible jumps near the end of the feed by triggering continuation before the user fully exhausts the rendered list and by rendering room-appropriate loading placeholders.

#### Scenario: Your studio reaches the end of the visible buffer
- **WHEN** the user approaches the end of the rendered `your-studio` list and another page is available
- **THEN** the system begins loading before the list visually stops and shows placeholders that match the studio grid structure

#### Scenario: Hall of fame appends ranked artworks
- **WHEN** the user approaches the end of the ranked `hall-of-fame` list and another page is available
- **THEN** the system shows loading feedback that matches the ranked grid structure closely enough to avoid a harsh layout jump when the next page arrives
