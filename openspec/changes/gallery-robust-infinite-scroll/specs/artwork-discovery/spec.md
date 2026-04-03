## MODIFIED Requirements

### Requirement: Public discovery excludes hidden artworks
The system SHALL exclude hidden artworks from public discovery and ranked feed surfaces while preserving the existing artwork feed-card contract for visible content. All gallery rooms SHALL actively paginate through discovery results using cursor-based continuation, rather than rendering only the first page.

#### Scenario: Recent feed excludes hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Recent` feed
- **THEN** the public discovery response does not include that artwork

#### Scenario: Ranked feeds exclude hidden artwork
- **WHEN** a hidden artwork would otherwise qualify for the `Hot` or `Top` feed
- **THEN** the public ranked discovery response does not include that artwork

#### Scenario: All rooms consume cursor metadata
- **WHEN** any gallery room loads its initial page of artworks
- **THEN** the response includes `discovery.request` with sort, limit, and cursor metadata enabling the frontend to fetch subsequent pages
