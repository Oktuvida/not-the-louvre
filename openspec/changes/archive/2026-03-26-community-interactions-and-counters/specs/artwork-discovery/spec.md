## MODIFIED Requirements

### Requirement: Artwork feed card projection
The system SHALL return a product-facing feed-card projection for each discovered artwork rather than exposing raw persistence rows. Each feed-card projection SHALL include the artwork identity, title, media URL, created timestamp, author summary, and engagement summary fields needed for listing views.

#### Scenario: Feed card includes author summary and media URL
- **WHEN** an artwork appears in a discovery response
- **THEN** the returned feed-card projection includes the artwork's author summary and an application-controlled media URL derived for client consumption

#### Scenario: Feed card includes engagement summary
- **WHEN** an artwork appears in a discovery response
- **THEN** the returned feed-card projection includes the artwork's current `score` and `commentCount`

### Requirement: Artwork detail retrieval
The system SHALL expose a backend read model for retrieving a single published artwork by identity for the artwork detail view.

#### Scenario: Artwork detail returns published artwork projection
- **WHEN** a client requests an existing published artwork by its identity
- **THEN** the system returns the detail projection for that artwork with its media URL, author summary, and engagement summary
