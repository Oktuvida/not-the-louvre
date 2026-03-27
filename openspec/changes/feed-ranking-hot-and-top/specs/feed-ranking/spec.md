## ADDED Requirements

### Requirement: Hot feed ranking
The system SHALL expose a `Hot` artwork discovery mode that orders active artworks by a backend-owned recency-weighted ranking derived from persisted engagement state and publish time.

#### Scenario: Higher hot rank for stronger recent engagement
- **WHEN** two active artworks are compared and one has a stronger recency-weighted ranking based on its persisted score and publish time
- **THEN** the `Hot` feed returns that artwork before the lower-ranked artwork

#### Scenario: Older artwork can rank below fresher artwork despite equal score
- **WHEN** two active artworks have equal persisted score but different publish times
- **THEN** the `Hot` feed ranks the fresher artwork ahead of the older artwork according to the active recency-weighted formula

### Requirement: Top feed ranking with explicit windows
The system SHALL expose a `Top` artwork discovery mode that orders active artworks by persisted score descending within an explicit ranking window.

#### Scenario: Top all-time orders by score descending
- **WHEN** a client requests the `Top` feed for the `All Time` window
- **THEN** the feed returns active artworks ordered by persisted score descending using deterministic tie-breaking

#### Scenario: Top today excludes older artworks
- **WHEN** a client requests the `Top` feed for the `Today` window
- **THEN** the feed includes only artworks published within the active `Today` window before applying score-based ordering

#### Scenario: Top this week excludes artworks outside the weekly window
- **WHEN** a client requests the `Top` feed for the `This Week` window
- **THEN** the feed includes only artworks published within the active weekly window before applying score-based ordering

### Requirement: Ranked feed query validation
The system SHALL validate ranked feed query inputs so only supported sort modes and supported top-feed windows are accepted.

#### Scenario: Unsupported sort rejected
- **WHEN** a client requests artwork discovery with an unsupported sort mode
- **THEN** the system rejects the request and does not return a feed payload

#### Scenario: Unsupported top window rejected
- **WHEN** a client requests the `Top` feed with an unsupported time-window value
- **THEN** the system rejects the request and does not return a ranked feed payload

### Requirement: Deterministic pagination for ranked feeds
The system SHALL provide deterministic pagination for `Hot` and `Top` feeds so incremental loading does not introduce unstable duplicates or omissions within a consistent ranked view.

#### Scenario: Ranked pagination returns stable continuation
- **WHEN** a client requests the next page of a ranked feed using a valid continuation cursor
- **THEN** the system returns the next ranked segment using the same ordering semantics as the initial page

#### Scenario: Ranked ties resolve deterministically
- **WHEN** two or more artworks have equal primary ranking values in the same ranked feed
- **THEN** the system applies deterministic tie-breaking so pagination order remains stable
