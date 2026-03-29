## ADDED Requirements

### Requirement: Ranked discovery remains usable for podium-specific presentation
The system SHALL preserve ranked discovery ordering and podium position information needed by gallery presentation surfaces to apply premium framing to the top three artworks only.

#### Scenario: Ranked gallery can identify the premium podium set
- **WHEN** a ranked gallery surface receives artworks ordered for podium presentation
- **THEN** the first three podium positions remain identifiable so the client can apply premium framing only to those artworks

#### Scenario: Non-podium ranked artworks remain outside the premium set
- **WHEN** a ranked gallery surface renders artworks after the first three podium positions
- **THEN** those artworks remain distinguishable from the podium set so the client can keep them on the standard frame tier
