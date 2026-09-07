## ADDED Requirements

### Requirement: Ambient audio defaults to off until the user opts in
The system SHALL initialize ambient audio as disabled when no stored or backend preference exists.

#### Scenario: First-time visitor opens the app
- **WHEN** a visitor opens the app without a stored or backend ambient audio preference
- **THEN** the system initializes ambient audio in the off state and does not start playback automatically

### Requirement: Ambient audio respects persisted enabled state across reloads
The system SHALL restore the user's saved ambient-audio enabled state on later visits.

#### Scenario: Signed-in user reloads with a saved ambient-audio preference
- **WHEN** a signed-in user reloads the app after previously saving an ambient-audio enabled or disabled preference
- **THEN** the system restores that saved enabled state before deciding whether playback should begin

### Requirement: Ambient audio resumes from the last selected track
The system SHALL restore the last selected ambient track on reload without restoring exact playback position.

#### Scenario: Visitor reloads after moving to another track
- **WHEN** a visitor reloads the app after previously reaching a later ambient track
- **THEN** the system restores that same track as the next ambient playback source and starts it from the beginning if audio is enabled

#### Scenario: Persisted track is no longer available
- **WHEN** the previously persisted ambient track is no longer present in the current playlist
- **THEN** the system falls back to the default available track without failing preference restoration