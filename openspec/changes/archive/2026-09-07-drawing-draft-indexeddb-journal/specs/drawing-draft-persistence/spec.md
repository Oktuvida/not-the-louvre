## ADDED Requirements

### Requirement: IndexedDB-backed draft recovery
The system SHALL persist artwork and avatar drafts in browser-local IndexedDB
and SHALL recover each draft from its latest stored snapshot plus any later
persisted stroke journal entries for the same draft identity.

#### Scenario: Artwork draft reload recovers the latest committed stroke
- **WHEN** an artwork draft has a persisted snapshot and one or more later
  committed stroke journal entries for the same user and scope
- **THEN** reloading the studio hydrates a drawing document equivalent to that
  snapshot with those later journal entries replayed in order

#### Scenario: Avatar draft reload recovers the latest committed stroke
- **WHEN** an avatar draft has persisted snapshot and journal data for the same
  draft user key
- **THEN** reloading the avatar sketch surface hydrates the latest recoverable
  avatar drawing from that IndexedDB data

### Requirement: Stroke-boundary journal persistence
The system SHALL record committed strokes as append-only draft journal entries
and SHALL not require a full persisted document rewrite for intermediate pointer
moves within the same active stroke.

#### Scenario: Dense pointer moves do not create multiple journal entries
- **WHEN** a user adds many points during one active stroke before releasing the
  pointer
- **THEN** the draft store does not persist a separate journal record for each
  intermediate point update

#### Scenario: Stroke commit appends one exact journal entry
- **WHEN** a user completes one stroke in the artwork or avatar editor
- **THEN** the draft store appends one journal entry whose persisted stroke data
  matches the committed canonical stroke values and order

### Requirement: Snapshot compaction bounds draft hydration cost
The system SHALL periodically materialize accumulated draft journal entries into
an updated snapshot and prune superseded journal entries without changing the
hydrated canonical drawing document.

#### Scenario: Compaction preserves the recovered document
- **WHEN** the system compacts a draft whose journal exceeds the configured
  threshold
- **THEN** the next hydration returns the same canonical drawing document that
  was recoverable immediately before compaction

#### Scenario: Superseded journal entries are removed only after snapshot update
- **WHEN** compaction writes a new draft snapshot from the current canonical
  document
- **THEN** the system prunes only the journal entries already represented by the
  committed snapshot update

### Requirement: Legacy local draft migration
The system SHALL import recoverable legacy draft payloads from the existing V2
or V1 browser local-storage keys when no IndexedDB draft exists yet for the same
draft identity.

#### Scenario: Valid legacy draft is imported on first IndexedDB miss
- **WHEN** draft hydration finds no IndexedDB draft for an identity but does
  find a valid legacy local draft payload
- **THEN** the system imports that payload into the IndexedDB snapshot store and
  hydrates the editor from the imported draft

#### Scenario: Invalid legacy draft does not poison IndexedDB recovery
- **WHEN** draft hydration finds a malformed or undecodable legacy local draft
  payload
- **THEN** the system discards that invalid legacy payload and does not persist
  it into IndexedDB

### Requirement: Fork continuation avoids duplicate parent document persistence
The system SHALL not separately persist a full fork parent drawing document
outside the draft store once the fork draft snapshot exists.

#### Scenario: Fork resume uses the draft snapshot as the canonical local seed
- **WHEN** a user resumes an existing local fork draft
- **THEN** the resumed editor state comes from the persisted fork draft snapshot
  plus journal data rather than a second persisted parent-document copy

#### Scenario: Fork cancel clears fork draft persistence
- **WHEN** a user abandons a fork draft explicitly
- **THEN** the system clears the persisted snapshot, journal entries, and any
  remaining lightweight fork-resume metadata for that fork draft identity

### Requirement: Draft lifecycle cleanup removes persisted entries
The system SHALL clear persisted draft snapshot and journal records when a draft
is no longer recoverable product state because it was successfully published,
successfully saved as an avatar, or explicitly abandoned.

#### Scenario: Artwork publish clears persisted artwork draft
- **WHEN** an artwork publish succeeds for a draft identity
- **THEN** the system removes persisted snapshot and journal data for that
  artwork draft

#### Scenario: Avatar save clears persisted avatar draft
- **WHEN** avatar save succeeds for a draft identity
- **THEN** the system removes persisted snapshot and journal data for that
  avatar draft

### Requirement: Storage failures preserve in-memory work and surface unsaved state
The system SHALL preserve the in-memory drawing document when IndexedDB
hydration, journal append, or compaction fails, and SHALL surface that the
latest local changes are not durably saved.

#### Scenario: Journal append failure preserves previous durable draft state
- **WHEN** a committed stroke cannot be persisted because the draft-store write
  fails
- **THEN** the editor keeps the current in-memory drawing and leaves the last
  successfully persisted draft state unchanged

#### Scenario: Corrupted persisted draft data is isolated to one draft identity
- **WHEN** hydration detects corrupted snapshot or journal data for one draft
  identity
- **THEN** the system clears or ignores only the affected draft data and does
  not wipe unrelated local drafts