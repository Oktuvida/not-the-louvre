## ADDED Requirements

### Requirement: Public discovery excludes hidden artworks
The system SHALL exclude hidden artworks from public discovery and ranked feed surfaces while preserving the existing artwork feed-card contract for visible content.

#### Scenario: Recent feed excludes hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Recent` feed
- **THEN** the public discovery response does not include that artwork

#### Scenario: Ranked feeds exclude hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Hot` or `Top` feed
- **THEN** the public ranked discovery response does not include that artwork

### Requirement: Public artwork detail respects hidden visibility state
The system SHALL prevent public artwork-detail reads from returning the normal visible-content projection for hidden artworks.

#### Scenario: Public detail request for hidden artwork
- **WHEN** a public requester asks for artwork detail on a hidden artwork
- **THEN** the system withholds the normal public artwork-detail response according to the active hidden-content policy
