## MODIFIED Requirements

### Requirement: Public discovery excludes hidden artworks
The system SHALL exclude hidden artworks from public discovery and ranked feed surfaces while preserving the existing artwork feed-card contract for visible content. Ranked discovery results MAY be consumed directly by product surfaces such as the homepage top-artwork teaser and the gallery, and those product surfaces MUST render only persisted visible-content results rather than fixture-only fallback content.

#### Scenario: Recent feed excludes hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Recent` feed
- **THEN** the public discovery response does not include that artwork

#### Scenario: Ranked feeds exclude hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Hot` or `Top` feed
- **THEN** the public ranked discovery response does not include that artwork

#### Scenario: Homepage teaser consumes ranked visible discovery results
- **WHEN** the homepage requests the top-ranked artwork teaser subset
- **THEN** the system returns persisted visible ranked discovery results suitable for direct homepage rendering without fixture fallback
