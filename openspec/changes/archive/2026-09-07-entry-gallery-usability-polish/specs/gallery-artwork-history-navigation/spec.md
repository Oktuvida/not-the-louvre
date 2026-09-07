## ADDED Requirements

### Requirement: In-room artwork detail closes before gallery route history exits
The system SHALL integrate artwork detail opened from a gallery room with local browser history so browser back closes the detail overlay before leaving the current room.

#### Scenario: Visitor opens artwork from the current room
- **WHEN** a visitor selects an artwork from the current gallery room
- **THEN** the system records a local detail-history entry for that selected artwork while keeping the current room intact

#### Scenario: Visitor presses back after opening artwork from the room
- **WHEN** a visitor uses browser back after opening artwork detail from within the current gallery room
- **THEN** the system closes the artwork detail overlay and keeps the visitor on the same gallery room

### Requirement: Non-local detail states keep normal history behavior
The system SHALL preserve normal browser-history behavior for gallery detail states that did not originate from selecting artwork inside the current room.

#### Scenario: Visitor is viewing a detail state without a local room-selection marker
- **WHEN** a visitor is on a gallery page in a detail state that was not opened from the current room interaction
- **THEN** browser back follows the normal history stack rather than forcing a local overlay close