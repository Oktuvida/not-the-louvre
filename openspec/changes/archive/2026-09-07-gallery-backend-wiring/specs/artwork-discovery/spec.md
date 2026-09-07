## MODIFIED Requirements

### Requirement: Public discovery excludes hidden artworks
The system SHALL exclude hidden artworks from public discovery and ranked feed surfaces while preserving the existing artwork feed-card contract for visible content. Product gallery routes that rely on public discovery SHALL consume those persisted visible-content results directly instead of substituting fixture-only artwork content.

#### Scenario: Recent feed excludes hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Recent` feed
- **THEN** the public discovery response does not include that artwork

#### Scenario: Ranked feeds exclude hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Hot` or `Top` feed
- **THEN** the public ranked discovery response does not include that artwork

#### Scenario: Product gallery consumes persisted visible discovery results
- **WHEN** a product gallery route requests public discovery data for its mapped room
- **THEN** the system returns persisted visible artwork results suitable for direct gallery rendering without requiring fixture fallback

### Requirement: Public artwork detail respects hidden visibility state
The system SHALL prevent public artwork-detail reads from returning the normal visible-content projection for hidden artworks. Product gallery detail selection SHALL rely on that same persisted artwork-detail visibility behavior rather than local mock detail data.

#### Scenario: Public detail request for hidden artwork
- **WHEN** a public requester asks for artwork detail on a hidden artwork
- **THEN** the system withholds the normal public artwork-detail response according to the active hidden-content policy

#### Scenario: Product gallery detail reads visible persisted artwork
- **WHEN** a user selects a visible artwork from the product gallery
- **THEN** the system returns the persisted artwork-detail projection for that artwork according to the active public visibility policy
