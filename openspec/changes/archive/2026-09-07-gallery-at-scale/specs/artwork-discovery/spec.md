## ADDED Requirements

### Requirement: Random artwork endpoint
The system SHALL expose a `GET /api/artworks/random` endpoint that returns a
single random non-hidden artwork from the entire database.

#### Scenario: Random endpoint returns a visible artwork
- **WHEN** a client calls `GET /api/artworks/random`
- **THEN** the response SHALL contain a single artwork that is not hidden

#### Scenario: Random endpoint respects NSFW filtering
- **WHEN** a client calls `GET /api/artworks/random` and the viewer has adult content disabled
- **THEN** the response SHALL not include NSFW artworks

#### Scenario: Random endpoint handles empty database
- **WHEN** no visible artworks exist in the database
- **THEN** the response SHALL return a 404 status

## MODIFIED Requirements

### Requirement: Public discovery excludes hidden artworks
The system SHALL exclude hidden artworks from public discovery and ranked feed surfaces while preserving the existing artwork feed-card contract for visible content. The random artwork endpoint SHALL also exclude hidden artworks.

#### Scenario: Recent feed excludes hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Recent` feed
- **THEN** the public discovery response does not include that artwork

#### Scenario: Ranked feeds exclude hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Hot` or `Top` feed
- **THEN** the public ranked discovery response does not include that artwork

#### Scenario: Random endpoint excludes hidden artwork
- **WHEN** a hidden artwork exists in the database
- **THEN** the `GET /api/artworks/random` endpoint SHALL never return it
