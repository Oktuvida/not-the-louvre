# Delta for artwork-discovery

## ADDED Requirements

### Requirement: Room artwork props carry viewer identity
The system MUST include the current viewer user ID in gallery room artwork data wiring so downstream components can apply author-specific exemptions.

#### Scenario: Your Studio supplies viewer ID
- GIVEN a gallery room renders artworks for the current user
- WHEN the room data is prepared for `PolaroidCard`
- THEN each artwork payload includes a `viewerId` field set to the current user ID

#### Scenario: PolaroidCard forwards viewer ID
- GIVEN an artwork payload contains `viewerId`
- WHEN `PolaroidCard` renders the artwork image
- THEN it passes `viewerId` to `NsfwImage` for author exemption evaluation
