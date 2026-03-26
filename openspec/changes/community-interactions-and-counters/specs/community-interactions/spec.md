## ADDED Requirements

### Requirement: One active artwork vote per user
The system SHALL allow an authenticated product user to express at most one active vote per artwork. An active vote MUST be either an upvote or a downvote, and the backend SHALL use the authenticated product identity to scope vote ownership.

#### Scenario: User upvotes an artwork without a previous vote
- **WHEN** an authenticated user submits an upvote for an artwork they have not yet voted on
- **THEN** the system persists that upvote as the user's one active vote for the artwork

#### Scenario: User downvotes an artwork without a previous vote
- **WHEN** an authenticated user submits a downvote for an artwork they have not yet voted on
- **THEN** the system persists that downvote as the user's one active vote for the artwork

#### Scenario: Unauthenticated user cannot vote
- **WHEN** a vote request is made without an authenticated product user
- **THEN** the system rejects the request and does not persist a vote

### Requirement: Vote replacement and removal
The system SHALL allow an authenticated product user to replace their existing vote on an artwork with the opposite value or remove their active vote entirely.

#### Scenario: User replaces upvote with downvote
- **WHEN** an authenticated user with an existing upvote submits a downvote for the same artwork
- **THEN** the system replaces the existing vote so the user's active vote becomes a downvote

#### Scenario: User removes active vote
- **WHEN** an authenticated user requests vote removal for an artwork they have already voted on
- **THEN** the system removes that user's active vote for the artwork

#### Scenario: Vote removal without existing vote is safe
- **WHEN** an authenticated user requests vote removal for an artwork they have not voted on
- **THEN** the system leaves the artwork's vote state unchanged and returns a successful no-op outcome

### Requirement: Canonical artwork score derivation
The system SHALL derive each artwork's score from persisted active votes using the canonical rule `score = upvotes - downvotes`. Artwork score exposed by backend reads MUST reflect the current persisted vote state after vote creation, replacement, or removal.

#### Scenario: Score increases after upvote
- **WHEN** an authenticated user adds an upvote to an artwork
- **THEN** subsequent backend reads expose an artwork score increased by one relative to the prior persisted state

#### Scenario: Score changes by two on opposite vote replacement
- **WHEN** an authenticated user replaces an existing upvote with a downvote on the same artwork
- **THEN** subsequent backend reads expose an artwork score decreased by two relative to the prior persisted state

#### Scenario: Score decreases after vote removal
- **WHEN** an authenticated user removes an existing upvote from an artwork
- **THEN** subsequent backend reads expose an artwork score decreased by one relative to the prior persisted state

### Requirement: Artwork comments lifecycle
The system SHALL allow an authenticated product user to create text-only comments on an artwork and read comments for an artwork in chronological order.

#### Scenario: Authenticated user adds a comment
- **WHEN** an authenticated user submits a valid comment body for an existing artwork
- **THEN** the system persists the comment with the user's canonical identity and associates it with that artwork

#### Scenario: Artwork comments are returned chronologically
- **WHEN** a client requests comments for an artwork with existing comments
- **THEN** the system returns the persisted comments in chronological order suitable for the product's flat comment list

#### Scenario: Comment rejected for unauthenticated requester
- **WHEN** a comment creation request is made without an authenticated product user
- **THEN** the system rejects the request and does not persist a comment

### Requirement: Comment contract enforcement and author deletion
The system SHALL enforce the comment text contract at the backend boundary and SHALL allow the comment author to delete their own comment from active content.

#### Scenario: Comment rejected for excessive length
- **WHEN** an authenticated user submits a comment body that exceeds the configured maximum comment length
- **THEN** the system rejects the comment and does not persist it

#### Scenario: Comment author deletes own comment
- **WHEN** the author of an existing comment requests deletion
- **THEN** the system removes that comment from active content

#### Scenario: Non-author cannot delete comment
- **WHEN** a user who did not create a comment requests deletion of that comment
- **THEN** the system rejects the request and leaves the comment unchanged

### Requirement: Canonical comment count derivation
The system SHALL derive each artwork's `commentCount` from active persisted comments. Artwork reads that expose engagement summaries MUST reflect the current persisted comment count after comment creation or deletion.

#### Scenario: Comment count increases after comment creation
- **WHEN** an authenticated user creates a comment on an artwork
- **THEN** subsequent backend reads expose that artwork's `commentCount` increased by one relative to the prior persisted state

#### Scenario: Comment count decreases after comment deletion
- **WHEN** the author deletes an existing comment on an artwork
- **THEN** subsequent backend reads expose that artwork's `commentCount` decreased by one relative to the prior persisted state

### Requirement: Engagement-enriched artwork reads
The system SHALL expose `score` and `commentCount` in the backend artwork read surfaces used for feed cards and artwork detail views so clients consume engagement summaries as part of the canonical artwork projection.

#### Scenario: Feed card exposes engagement summary
- **WHEN** a client requests artwork discovery results
- **THEN** each returned feed-card projection includes the artwork's current `score` and `commentCount`

#### Scenario: Artwork detail exposes engagement summary
- **WHEN** a client requests artwork detail for an existing artwork
- **THEN** the returned detail projection includes the artwork's current `score` and `commentCount`

### Requirement: Abuse protection for engagement-sensitive actions
The system SHALL enforce durable server-side rate limiting for artwork voting and comment creation so repeated engagement attempts from the same authenticated actor cannot exceed the configured active limit windows.

#### Scenario: Too many vote attempts within active window
- **WHEN** an authenticated user exceeds the configured voting threshold within the active vote-limit window
- **THEN** the system temporarily rejects further vote attempts for that user until the active limit window expires

#### Scenario: Too many comment attempts within active window
- **WHEN** an authenticated user exceeds the configured comment threshold within the active comment-limit window
- **THEN** the system temporarily rejects further comment creation attempts for that user until the active limit window expires

#### Scenario: Durable engagement abuse protection survives restart
- **WHEN** the application process restarts after engagement-limit counters have already been recorded within an active limit window
- **THEN** the system continues enforcing that active limit window instead of resetting the counters to zero
