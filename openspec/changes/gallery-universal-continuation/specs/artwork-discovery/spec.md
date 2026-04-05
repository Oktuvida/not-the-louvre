## MODIFIED Requirements

### Requirement: Public discovery excludes hidden artworks
The system SHALL exclude hidden artworks from public discovery and ranked feed surfaces while preserving the existing artwork feed-card contract for visible content. The discovery response SHALL include cursor-based pagination metadata for all sort types and all consuming rooms.

#### Scenario: Recent feed excludes hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Recent` feed
- **THEN** the public discovery response does not include that artwork

#### Scenario: Ranked feeds exclude hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Hot` or `Top` feed
- **THEN** the public ranked discovery response does not include that artwork

#### Scenario: Discovery response includes cursor metadata for all rooms
- **WHEN** a gallery room requests artwork discovery regardless of room identity
- **THEN** the server response includes pagination cursor metadata enabling the consumer to request subsequent pages
