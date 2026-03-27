## ADDED Requirements

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
