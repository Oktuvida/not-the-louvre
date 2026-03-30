## ADDED Requirements

### Requirement: Room switching uses lateral slide transition
The system SHALL animate a horizontal slide when the user switches between gallery rooms, communicating spatial adjacency.

#### Scenario: Navigating to a room to the right
- **WHEN** the user clicks a room tab that is later in the room order than the current room
- **THEN** the current room content SHALL slide out to the left
- **AND** the new room content SHALL slide in from the right

#### Scenario: Navigating to a room to the left
- **WHEN** the user clicks a room tab that is earlier in the room order than the current room
- **THEN** the current room content SHALL slide out to the right
- **AND** the new room content SHALL slide in from the left

### Requirement: Rapid room switching is handled gracefully
The system SHALL handle rapid sequential room tab clicks without visual glitches.

#### Scenario: User clicks multiple room tabs quickly
- **WHEN** the user clicks a room tab while a slide transition is already in progress
- **THEN** the in-progress transition SHALL be cancelled or fast-forwarded
- **AND** the new transition to the latest selected room SHALL begin immediately
