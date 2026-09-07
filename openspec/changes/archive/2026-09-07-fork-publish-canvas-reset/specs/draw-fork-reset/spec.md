## ADDED Requirements

### Requirement: Successful fork publish leaves the draw route in new-artwork mode
The system SHALL exit fork mode after a successful fork publish and reset the active draw document to a new empty artwork baseline.

#### Scenario: User publishes a fork successfully
- **WHEN** an authenticated user successfully publishes artwork from `/draw` with a parent artwork context
- **THEN** the system clears the active draw document to a new empty artwork and does not retain the parent artwork as the current editing baseline

#### Scenario: User starts another artwork after successful fork publish
- **WHEN** a successful fork publish has completed and the user starts drawing again from the same draw-route session
- **THEN** the system continues from an empty new-artwork state rather than restoring the previous fork parent

#### Scenario: User publishes non-fork artwork successfully
- **WHEN** an authenticated user successfully publishes artwork from `/draw` without a parent artwork context
- **THEN** the system preserves the non-fork post-publish flow and does not reintroduce stale fork state

### Requirement: Fork context is discarded after successful publish
The system SHALL discard persisted fork context and fork-scoped drafts once a fork publish succeeds.

#### Scenario: User reloads after successful fork publish
- **WHEN** a user reloads `/draw` after a successful fork publish
- **THEN** the system does not rehydrate the previous fork parent or fork-scoped draft state