# artwork-discovery Specification

## Purpose
Public discovery feeds and artwork detail reads, including hidden-visibility rules.

## Requirements

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

### Requirement: Public artwork detail respects hidden visibility state
The system SHALL prevent public artwork-detail reads from returning the normal visible-content projection for hidden artworks. Product gallery detail selection SHALL rely on that same persisted artwork-detail visibility behavior rather than local mock detail data.

#### Scenario: Public detail request for hidden artwork
- **WHEN** a public requester asks for artwork detail on a hidden artwork
- **THEN** the system withholds the normal public artwork-detail response according to the active hidden-content policy

#### Scenario: Product gallery detail reads visible persisted artwork
- **WHEN** a user selects a visible artwork from the product gallery
- **THEN** the system returns the persisted artwork-detail projection for that artwork according to the active public visibility policy

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

### Requirement: Recent artwork feed discovery
The system SHALL expose a backend read model for discovering published artworks in reverse chronological order. The initial implemented discovery mode SHALL support the `Recent` feed while leaving room for future sort modes without replacing the base discovery contract.

#### Scenario: Recent feed returns newest artworks first
- **WHEN** a client requests the `Recent` artwork feed
- **THEN** the system returns published artworks ordered from newest to oldest

### Requirement: Paginated artwork discovery
The system SHALL paginate artwork discovery results using a stable continuation model suitable for infinite scroll so clients can load additional feed results incrementally. The continuation semantics MUST remain stable across long-running product gallery sessions that request many sequential segments from the same ordered discovery view.

#### Scenario: Feed request returns continuation information
- **WHEN** a client requests a page of artwork discovery results
- **THEN** the system returns the current page of artworks together with the continuation information needed to request the next page

#### Scenario: Follow-up feed request continues after prior page
- **WHEN** a client requests the next page using continuation information from a previous feed response
- **THEN** the system returns the next set of artworks without repeating already returned items from the same ordering sequence

#### Scenario: Long-running gallery continuation stays stable
- **WHEN** a product gallery client requests many sequential discovery segments from the same room-mapped ordering
- **THEN** the system preserves deterministic continuation semantics without introducing duplicate or skipped artworks across those sequential segments

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

### Requirement: Multi-sort artwork discovery
The system SHALL support three explicit artwork discovery sort modes: `Recent`, `Hot`, and `Top`. Each mode SHALL return the same product-facing feed-card projection while applying its own backend-owned ordering rules.

#### Scenario: Discovery request for recent feed
- **WHEN** a client requests artwork discovery with the `Recent` sort mode
- **THEN** the system returns the existing chronological feed behavior using the canonical feed-card projection

#### Scenario: Discovery request for hot feed
- **WHEN** a client requests artwork discovery with the `Hot` sort mode
- **THEN** the system returns the canonical feed-card projection ordered by the backend-owned hot ranking behavior

#### Scenario: Discovery request for top feed
- **WHEN** a client requests artwork discovery with the `Top` sort mode and a supported ranking window
- **THEN** the system returns the canonical feed-card projection ordered by the backend-owned top ranking behavior for that window
