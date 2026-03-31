## ADDED Requirements

### Requirement: Gallery artwork media loads progressively
The system SHALL mark non-critical gallery artwork media for progressive browser loading so offscreen gallery images are not eagerly fetched and decoded on first gallery render.

#### Scenario: Offscreen gallery card media is deferred
- **WHEN** a user opens a gallery room that contains artwork cards outside the initial viewport
- **THEN** the rendered gallery media SHALL include explicit lazy-loading behavior for those offscreen artwork images

#### Scenario: Gallery media remains viewable when artwork enters the viewport
- **WHEN** a lazily loaded artwork image scrolls into the browser's loading threshold
- **THEN** the system SHALL load and render that artwork image without changing the gallery card behavior

### Requirement: Gallery room-specific UI can load on demand
The system SHALL allow room-scoped gallery UI to load without requiring every room implementation to ship in the initial gallery route payload.

#### Scenario: User opens the default gallery room
- **WHEN** a user navigates to `/gallery`
- **THEN** the system SHALL render the active room without requiring non-active room-specific UI to be part of the first room render path

#### Scenario: User switches to another room
- **WHEN** a user navigates from one gallery room to another
- **THEN** the system SHALL load any newly required room-specific UI and preserve room navigation behavior

### Requirement: Gallery detail data stays on-demand
The system SHALL continue loading artwork detail data only after the user selects an artwork from the gallery.

#### Scenario: User browses gallery without opening artwork detail
- **WHEN** a user views a gallery room and does not select any artwork
- **THEN** the system SHALL NOT fetch per-artwork detail payloads for every visible gallery item during the initial gallery render

#### Scenario: User opens artwork detail from the gallery
- **WHEN** a user selects an artwork in the gallery
- **THEN** the system SHALL fetch and render that artwork's detail data on demand
