## ADDED Requirements

### Requirement: Gallery routes load persisted artwork discovery data
The system SHALL load real persisted artwork discovery data for product gallery routes instead of rendering fixture-only artwork content.

#### Scenario: Default gallery route shows persisted discovery results
- **WHEN** a user opens `/gallery`
- **THEN** the system loads persisted artwork discovery data for the default gallery room and renders real artwork cards

#### Scenario: Room gallery route shows persisted discovery results
- **WHEN** a user opens a valid gallery room route
- **THEN** the system loads persisted artwork discovery data for that room mapping and renders real artwork cards for that result set

### Requirement: Gallery routes handle sparse or unavailable data honestly
The system SHALL surface real empty and failure states for gallery discovery rather than falling back to mock content.

#### Scenario: Gallery room has no discoverable artworks
- **WHEN** a gallery route resolves successfully but the mapped discovery query returns no artworks
- **THEN** the system renders a product-facing empty state for that room

#### Scenario: Gallery discovery cannot be loaded
- **WHEN** the gallery route cannot resolve its backend discovery data
- **THEN** the system renders a safe product-facing failure state instead of fixture content

### Requirement: Gallery selection opens real artwork detail
The system SHALL allow a user to open artwork detail from persisted gallery discovery results.

#### Scenario: User selects a real artwork card
- **WHEN** a user selects an artwork from a gallery discovery result
- **THEN** the system opens artwork detail based on real persisted artwork data for that selected item
