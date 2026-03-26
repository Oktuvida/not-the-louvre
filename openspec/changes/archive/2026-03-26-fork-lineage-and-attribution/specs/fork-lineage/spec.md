## ADDED Requirements

### Requirement: Artwork can be published as a fork of another artwork
The system SHALL allow an authenticated product user to publish a new artwork as a fork of an existing active artwork by associating the new artwork with exactly one parent artwork at creation time.

#### Scenario: Successful fork publish with valid parent artwork
- **WHEN** an authenticated user publishes a new artwork and provides the identity of an existing active parent artwork
- **THEN** the system persists the new artwork as a distinct artwork record associated with that parent artwork

#### Scenario: Fork publish rejected for missing parent artwork
- **WHEN** an authenticated user attempts to publish a fork referencing an artwork identity that does not exist as active content
- **THEN** the system rejects the publish request and does not persist the forked artwork

### Requirement: Canonical parent-child lineage persistence
The system SHALL persist fork lineage through a canonical parent-child relationship so each forked artwork references at most one immediate parent artwork and each artwork can be the parent of multiple direct child forks.

#### Scenario: Fork persists immediate parent reference
- **WHEN** a forked artwork is successfully created
- **THEN** the persisted artwork record stores the identity of its immediate parent artwork

#### Scenario: Original artwork has no parent reference
- **WHEN** an artwork is published without forking another artwork
- **THEN** the persisted artwork record has no parent artwork reference

### Requirement: Fork attribution in artwork reads
The system SHALL expose whether an artwork is original or forked in the product-facing artwork read contract. For forked artworks, the read contract SHALL expose attribution to the immediate parent artwork and its author when that parent remains available as active content.

#### Scenario: Fork read exposes live parent attribution
- **WHEN** a client reads a forked artwork whose parent artwork still exists as active content
- **THEN** the returned artwork projection includes attribution to that immediate parent artwork and parent author

#### Scenario: Original artwork read has no fork attribution
- **WHEN** a client reads an artwork that was not created as a fork
- **THEN** the returned artwork projection indicates no parent attribution

### Requirement: Deleted-parent attribution resilience
The system SHALL preserve the fork identity of a child artwork even if its parent artwork is later deleted. In that state, the artwork read contract SHALL continue identifying the artwork as a fork while marking its parent attribution as deleted or unavailable.

#### Scenario: Fork remains active after parent deletion
- **WHEN** the parent artwork of an existing fork is deleted after the fork has already been created
- **THEN** the fork remains readable as active content

#### Scenario: Deleted parent yields degraded attribution state
- **WHEN** a client reads a fork whose parent artwork has been deleted
- **THEN** the returned artwork projection identifies the artwork as a fork and reports that the parent attribution is deleted or unavailable rather than treating it as an original artwork

### Requirement: Immediate lineage navigation in artwork detail reads
The system SHALL expose immediate lineage navigation for artwork detail views by returning at most one parent summary and the set of direct child forks associated with the current artwork.

#### Scenario: Detail read returns parent summary for forked artwork
- **WHEN** a client requests detail for a forked artwork whose parent still exists as active content
- **THEN** the returned detail projection includes a summary of the immediate parent artwork suitable for navigation

#### Scenario: Detail read returns direct child forks
- **WHEN** a client requests detail for an artwork that has one or more direct child forks
- **THEN** the returned detail projection includes summaries for those direct child forks suitable for navigation

### Requirement: Canonical fork count derivation
The system SHALL derive each artwork's `forkCount` from persisted direct child forks. Artwork reads that expose lineage summaries MUST reflect the current persisted direct fork count after fork creation or child deletion.

#### Scenario: Fork count increases after child fork creation
- **WHEN** an authenticated user successfully creates a new fork of an artwork
- **THEN** subsequent backend reads expose that parent artwork's `forkCount` increased by one relative to the prior persisted state

#### Scenario: Fork count decreases after child fork deletion
- **WHEN** a direct child fork of an artwork is deleted
- **THEN** subsequent backend reads expose that parent artwork's `forkCount` decreased by one relative to the prior persisted state
