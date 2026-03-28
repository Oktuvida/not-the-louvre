## ADDED Requirements

### Requirement: Authenticated users can report artworks and comments
The system SHALL allow an authenticated product user to report an artwork or a comment by submitting a structured report reason and optional free-text context against exactly one active moderation target. The system SHALL allow at most one active pending report per reporter and target at a time.

#### Scenario: Authenticated user reports artwork
- **WHEN** an authenticated user submits a valid report targeting an existing artwork and does not already have a pending report for that artwork
- **THEN** the system persists a pending report linked to that artwork and the reporting user

#### Scenario: Authenticated user reports comment
- **WHEN** an authenticated user submits a valid report targeting an existing comment and does not already have a pending report for that comment
- **THEN** the system persists a pending report linked to that comment and the reporting user

#### Scenario: Duplicate active report is rejected
- **WHEN** an authenticated user submits a report for a target they have already reported with a pending unresolved report
- **THEN** the system rejects the duplicate active report and does not persist another pending report for that same target

#### Scenario: Unauthenticated user cannot report content
- **WHEN** a report request is made without an authenticated product user
- **THEN** the system rejects the request and does not persist a report

### Requirement: Report target integrity
The system SHALL require each report to target exactly one moderation object: either an artwork or a comment, but not both and not neither.

#### Scenario: Report rejected with no target
- **WHEN** a client submits a report request without an artwork target or comment target
- **THEN** the system rejects the request and does not persist a report

#### Scenario: Report rejected with multiple targets
- **WHEN** a client submits a report request that targets both an artwork and a comment at the same time
- **THEN** the system rejects the request and does not persist a report

### Requirement: Auto-hide threshold for reported content
The system SHALL automatically hide reported artwork or comment content from public views once the configured active pending report threshold for that target is reached. The threshold transition SHALL remain correct and idempotent under concurrent report submissions affecting the same target, and resolved reports SHALL no longer contribute to that active threshold.

#### Scenario: Artwork becomes hidden after active threshold reached
- **WHEN** pending active reports against an artwork reach the configured auto-hide threshold
- **THEN** the system transitions that artwork into a hidden state for public reads

#### Scenario: Comment becomes hidden after active threshold reached
- **WHEN** pending active reports against a comment reach the configured auto-hide threshold
- **THEN** the system transitions that comment into a hidden state for public reads

#### Scenario: Concurrent reports still produce one correct hidden-state transition
- **WHEN** multiple report submissions for the same artwork or comment are committed concurrently around the configured threshold
- **THEN** the system applies a correct, idempotent hidden-state transition without leaving the target below-threshold visible or producing inconsistent moderation state

#### Scenario: Resolved reports stop contributing to active threshold
- **WHEN** previously pending reports for a target are resolved through moderator review
- **THEN** those resolved reports no longer contribute to the target's active pending report count

### Requirement: Moderator visibility controls
The system SHALL allow authenticated moderators to hide, unhide, and delete reported artworks and comments through backend moderation actions.

#### Scenario: Moderator hides reported content
- **WHEN** an authenticated moderator requests that a reported artwork or comment be hidden
- **THEN** the system marks that content as hidden for public reads

#### Scenario: Moderator unhides content
- **WHEN** an authenticated moderator requests that a hidden artwork or comment be restored
- **THEN** the system removes the hidden state so the content can reappear in public reads

#### Scenario: Moderator deletes reported content
- **WHEN** an authenticated moderator requests deletion of a reported artwork or comment
- **THEN** the system permanently removes or invalidates that content according to the applicable backend deletion policy

#### Scenario: Non-moderator cannot perform moderation actions
- **WHEN** an authenticated user without moderator privileges attempts a moderation action
- **THEN** the system rejects the request and leaves the target content unchanged

### Requirement: Hidden-content visibility semantics
The system SHALL enforce hidden-content visibility based on requester context so public users do not receive hidden content while authorized moderation or owner contexts can still resolve it according to backend policy.

#### Scenario: Hidden artwork excluded from public discovery
- **WHEN** a public discovery request would otherwise include a hidden artwork
- **THEN** the system omits that artwork from the public feed results

#### Scenario: Hidden artwork unavailable in public detail read
- **WHEN** a public client requests detail for a hidden artwork
- **THEN** the system does not return the normal public artwork detail projection

#### Scenario: Hidden content remains available to moderator review
- **WHEN** an authenticated moderator requests a hidden moderation target for review
- **THEN** the system returns the content according to the authorized moderation read policy
