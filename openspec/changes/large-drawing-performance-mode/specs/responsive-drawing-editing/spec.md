## ADDED Requirements

### Requirement: Responsive editing buffers active strokes outside the canonical document
The system SHALL keep the active stroke in transient editor state for large
drawing sessions so dense pointer input does not mutate the canonical Stroke
JSON document on every pointer move.

#### Scenario: Large studio drawing uses a buffered active stroke
- **WHEN** the studio hydrates a large existing or forked drawing and the user
  begins a dense new stroke
- **THEN** the in-progress stroke remains visible during input while the
  canonical document stays unchanged until the stroke is completed

#### Scenario: Buffered stroke commits exact captured points
- **WHEN** the user finishes a buffered stroke in responsive editing mode
- **THEN** the canonical document appends one completed stroke containing the
  captured points in their original order and values

### Requirement: Responsive editing activates automatically for large drawings
The system SHALL automatically enable responsive editing mode for drawings whose
size or replay cost exceeds the configured large-drawing thresholds, regardless
of whether the drawing is newly created, hydrated, or forked.

#### Scenario: Large hydrated fork activates responsive editing
- **WHEN** the studio hydrates a fork or existing artwork above the configured
  large-drawing thresholds
- **THEN** subsequent active drawing uses responsive editing mode without user
  opt-in

#### Scenario: Large avatar sketch activates responsive editing
- **WHEN** the avatar sketch surface exceeds the configured large-drawing
  thresholds or replay-cost gate
- **THEN** subsequent active drawing uses the same responsive editing contract
  as the studio surface

### Requirement: Completed strokes drive parent synchronization and draft persistence
The system SHALL defer parent document synchronization and local draft
persistence until a buffered stroke is committed while responsive editing mode
is active.

#### Scenario: Dense pointer moves do not autosave intermediate points
- **WHEN** a user adds many points during one active stroke in responsive
  editing mode
- **THEN** the system does not persist or synchronize a new canonical document
  for each intermediate point

#### Scenario: Stroke completion triggers one canonical sync and one draft save
- **WHEN** the user completes an active stroke in responsive editing mode
- **THEN** the system emits one updated canonical document to parent state and
  persists one draft that includes the completed stroke

### Requirement: Responsive editing preserves Stroke JSON authority across render and publish boundaries
The system SHALL treat any committed render cache or overlay state as
non-authoritative and SHALL continue to derive hydration resets, clear
operations, fork cancellation, and publish preparation from the canonical
Stroke JSON document.

#### Scenario: Hydration and reset rebuild from the canonical document
- **WHEN** the editor hydrates a different seed, clears the drawing, or
  abandons fork-specific state
- **THEN** any responsive-editing render acceleration state is rebuilt or
  discarded from the canonical Stroke JSON state rather than reused as source
  data

#### Scenario: Publish uses the canonical document after responsive editing
- **WHEN** a user publishes after drawing in responsive editing mode
- **THEN** publish preparation uses the canonical Stroke JSON document and not
  the render acceleration state