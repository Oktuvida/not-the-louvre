## MODIFIED Requirements

### Requirement: Auto-hide threshold for reported content
The system SHALL automatically hide reported artwork or comment content from public views once the configured active report threshold for that target is reached. The threshold transition SHALL remain correct and idempotent under concurrent report submissions affecting the same target.

#### Scenario: Artwork becomes hidden after threshold reached
- **WHEN** active reports against an artwork reach the configured auto-hide threshold
- **THEN** the system transitions that artwork into a hidden state for public reads

#### Scenario: Comment becomes hidden after threshold reached
- **WHEN** active reports against a comment reach the configured auto-hide threshold
- **THEN** the system transitions that comment into a hidden state for public reads

#### Scenario: Concurrent reports still produce one correct hidden-state transition
- **WHEN** multiple report submissions for the same artwork or comment are committed concurrently around the configured threshold
- **THEN** the system applies a correct, idempotent hidden-state transition without leaving the target below-threshold visible or producing inconsistent moderation state