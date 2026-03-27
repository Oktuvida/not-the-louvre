## ADDED Requirements

### Requirement: Artwork detail vote updates are delivered in realtime
The system SHALL expose secure realtime vote-change events for a single artwork detail context so authenticated clients can observe score-affecting vote transitions without polling.

#### Scenario: Authenticated subscriber receives vote changes for one artwork
- **WHEN** an authenticated client subscribes to vote changes for a specific artwork and a vote for that artwork is created, changed, or removed
- **THEN** the system emits a realtime event scoped to that artwork so the client can update or refresh the artwork detail score state

#### Scenario: Subscription does not receive unrelated artwork vote changes
- **WHEN** an authenticated client is subscribed to vote changes for one artwork
- **THEN** the system does not deliver vote events for other artworks on that subscription

### Requirement: Artwork detail comment updates are delivered in realtime
The system SHALL expose secure realtime comment-change events for a single artwork detail context so authenticated clients can observe comment lifecycle changes that affect the visible comment list.

#### Scenario: Authenticated subscriber receives visible comment additions
- **WHEN** an authenticated client subscribes to comment changes for a specific artwork and a visible comment is created for that artwork
- **THEN** the system emits a realtime event scoped to that artwork so the client can append or refresh the visible comment list

#### Scenario: Comment moderation or deletion invalidates visible comment state
- **WHEN** a subscribed artwork comment is hidden, restored, or deleted in a way that changes public comment visibility
- **THEN** the system emits enough scoped realtime change information for the client to reconcile the visible comment list for that artwork

### Requirement: Realtime exposure is least-privilege and policy-protected
The system SHALL protect every realtime-exposed vote and comment relation with row-level security and least-privilege grants before clients can subscribe.

#### Scenario: Authorized client can subscribe to allowed social events
- **WHEN** an authenticated client subscribes to the allowed realtime vote or comment stream for an artwork
- **THEN** the system authorizes the subscription according to the active row-level security policy

#### Scenario: Realtime payload excludes non-public backend fields
- **WHEN** a realtime vote or comment event is delivered to a client
- **THEN** the payload does not expose recovery data, moderation-only fields, storage secrets, or other backend-only columns

#### Scenario: Unauthorized client cannot observe restricted events
- **WHEN** a client does not satisfy the realtime policy for the requested social stream
- **THEN** the system denies access to those events