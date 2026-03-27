## ADDED Requirements

### Requirement: Artwork score remains canonical under vote mutations
The system SHALL maintain each artwork `score` as a database-owned derived value that remains correct after vote creation, vote replacement, vote removal, and concurrent vote mutations.

#### Scenario: Vote creation increments score canonically
- **WHEN** a vote is created for an artwork
- **THEN** the system updates the artwork score to reflect the new canonical sum of active vote values

#### Scenario: Vote replacement or removal preserves canonical score
- **WHEN** an existing vote is changed or removed
- **THEN** the system updates the artwork score so it still matches the canonical sum of active vote values for that artwork

### Requirement: Public comment counts remain canonical under visibility-affecting mutations
The system SHALL maintain each artwork `commentCount` as a database-owned derived value that reflects the comments currently visible to public artwork discovery and detail reads.

#### Scenario: Visible comment creation increments public count
- **WHEN** a visible comment is created for an artwork
- **THEN** the system increments that artwork's canonical public comment count

#### Scenario: Delete or hide removes comment from public count
- **WHEN** a comment is deleted or transitioned into a hidden state
- **THEN** the system decrements or recalculates the artwork's canonical public comment count so public read models remain consistent

#### Scenario: Unhide restores comment to public count
- **WHEN** a hidden comment becomes publicly visible again
- **THEN** the system restores the artwork's canonical public comment count accordingly

### Requirement: Public fork counts remain canonical under visibility-affecting mutations
The system SHALL maintain each artwork `forkCount` as a database-owned derived value that reflects active child forks visible to public artwork reads.

#### Scenario: New visible fork increments public fork count
- **WHEN** a new visible child fork is created for an artwork
- **THEN** the system increments that artwork's canonical public fork count

#### Scenario: Delete or hide removes fork from public count
- **WHEN** a child fork is deleted or transitioned into a hidden state
- **THEN** the system decrements or recalculates the parent artwork's canonical public fork count so public lineage summaries remain consistent

#### Scenario: Unhide restores fork to public count
- **WHEN** a hidden child fork becomes publicly visible again
- **THEN** the system restores the parent artwork's canonical public fork count accordingly