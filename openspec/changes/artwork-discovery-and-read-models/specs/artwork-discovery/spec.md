## ADDED Requirements

### Requirement: Recent artwork feed discovery
The system SHALL expose a backend read model for discovering published artworks in reverse chronological order. The initial implemented discovery mode SHALL support the `Recent` feed while leaving room for future sort modes without replacing the base discovery contract.

#### Scenario: Recent feed returns newest artworks first
- **WHEN** a client requests the `Recent` artwork feed
- **THEN** the system returns published artworks ordered from newest to oldest

### Requirement: Paginated artwork discovery
The system SHALL paginate artwork discovery results using a stable continuation model suitable for infinite scroll so clients can load additional feed results incrementally.

#### Scenario: Feed request returns continuation information
- **WHEN** a client requests a page of artwork discovery results
- **THEN** the system returns the current page of artworks together with the continuation information needed to request the next page

#### Scenario: Follow-up feed request continues after prior page
- **WHEN** a client requests the next page using continuation information from a previous feed response
- **THEN** the system returns the next set of artworks without repeating already returned items from the same ordering sequence

### Requirement: Artwork feed card projection
The system SHALL return a product-facing feed-card projection for each discovered artwork rather than exposing raw persistence rows. Each feed-card projection SHALL include the artwork identity, title, media URL, created timestamp, and author summary needed for listing views.

#### Scenario: Feed card includes author summary and media URL
- **WHEN** an artwork appears in a discovery response
- **THEN** the returned feed-card projection includes the artwork's author summary and an application-controlled media URL derived for client consumption

### Requirement: Artwork detail retrieval
The system SHALL expose a backend read model for retrieving a single published artwork by identity for the artwork detail view.

#### Scenario: Artwork detail returns published artwork projection
- **WHEN** a client requests an existing published artwork by its identity
- **THEN** the system returns the detail projection for that artwork with its media URL and author summary

### Requirement: Application-controlled media URLs for artwork reads
The system SHALL derive client-facing artwork media URLs from persisted internal storage references. Client-facing artwork read models MUST expose application-controlled media URLs rather than raw storage keys or direct public bucket URLs as the primary media reference.

#### Scenario: Read model hides internal storage key
- **WHEN** a client receives an artwork feed or detail projection
- **THEN** the primary media reference exposed by the read model is an application-controlled media URL instead of the persisted internal storage key

### Requirement: Canonical author projection for artwork reads
The system SHALL derive artwork author data from the application-owned user identity record so artwork reads expose canonical product identity fields rather than auth-engine internals.

#### Scenario: Artwork read includes canonical author identity fields
- **WHEN** a client receives an artwork feed or detail projection
- **THEN** the included author summary reflects the product user's canonical nickname and avatar information

### Requirement: Deleted or missing artworks are not found
The system SHALL treat deleted or otherwise missing artworks as not-found content in artwork read paths. Deleted artworks SHALL not appear in discovery results, and direct reads for deleted artworks SHALL return not found.

#### Scenario: Deleted artwork omitted from feed results
- **WHEN** an artwork has been deleted and a client requests artwork discovery results
- **THEN** the deleted artwork is not returned in the feed response

#### Scenario: Deleted artwork detail returns not found
- **WHEN** a client requests detail for a deleted artwork
- **THEN** the system returns not found

#### Scenario: Unknown artwork detail returns not found
- **WHEN** a client requests detail for an artwork identity that does not exist
- **THEN** the system returns not found
