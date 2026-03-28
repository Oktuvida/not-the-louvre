## MODIFIED Requirements

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
