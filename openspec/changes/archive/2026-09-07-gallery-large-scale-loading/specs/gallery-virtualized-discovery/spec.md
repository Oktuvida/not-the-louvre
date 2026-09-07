## ADDED Requirements

### Requirement: Gallery discovery loads incrementally with cursor continuation
The system SHALL allow gallery rooms with scalable discovery collections to load additional artwork segments using stable continuation cursors instead of requiring all discoverable artworks in the initial gallery render.

#### Scenario: Gallery renders initial discovery segment
- **WHEN** a user opens a scalable gallery room
- **THEN** the system renders the initial discovery segment and retains the continuation information needed to request more artworks

#### Scenario: Gallery requests the next discovery segment while scrolling
- **WHEN** the user reaches the continuation threshold for the currently loaded gallery range
- **THEN** the system requests the next discovery segment using the prior continuation cursor and appends only new artworks to the loaded gallery data

### Requirement: Gallery keeps mounted artwork cards bounded while scrolling
The system SHALL keep only the currently visible artwork cards and a bounded overscan range mounted for scalable gallery rooms.

#### Scenario: User scrolls far past early artworks
- **WHEN** a user scrolls well beyond an earlier range of gallery cards
- **THEN** the system unmounts cards that are outside the active visible-plus-overscan range

#### Scenario: User scrolls back to a previously seen range
- **WHEN** a user scrolls back to a gallery range whose cards were previously unmounted
- **THEN** the system recreates the needed cards from the already loaded discovery data and preserves gallery interaction behavior

### Requirement: Virtualized gallery browsing preserves on-demand detail loading
The system SHALL keep artwork detail fetches on demand even when discovery rendering is incremental and virtualized.

#### Scenario: User scrolls through virtualized gallery without opening a card
- **WHEN** a user browses a virtualized gallery room without selecting an artwork
- **THEN** the system does not fetch per-artwork detail payloads for the browsed cards

#### Scenario: User opens artwork detail from a virtualized card
- **WHEN** a user selects a currently visible virtualized gallery card
- **THEN** the system fetches and renders that artwork's detail data on demand
