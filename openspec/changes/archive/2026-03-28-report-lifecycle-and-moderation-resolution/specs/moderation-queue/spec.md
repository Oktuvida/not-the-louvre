## MODIFIED Requirements

### Requirement: Moderator report queue listing
The system SHALL allow authenticated moderators to query a list of reported content pending review. The listing SHALL include both reported artworks and reported comments, ordered by active pending report count descending, with enough target context for the moderator to take action. Targets whose reports are fully resolved SHALL no longer appear in the active moderation queue unless new pending reports are submitted later.

#### Scenario: Moderator lists pending reported content
- **WHEN** an authenticated moderator requests the moderation queue
- **THEN** the system returns reported artworks and comments ordered by active pending report count descending, including target identity, content summary, author information, report count, and hidden state

#### Scenario: Resolved case leaves queue
- **WHEN** all pending reports for a moderation target have been resolved through review or action
- **THEN** the system excludes that target from active moderation queue results

#### Scenario: New pending report reopens prior target
- **WHEN** a target previously left the moderation queue because its active reports were resolved and a new pending report is later submitted for that target
- **THEN** the system includes that target in the active moderation queue again using the new pending report count

#### Scenario: Non-moderator cannot access the moderation queue
- **WHEN** an authenticated user without moderator privileges requests the moderation queue
- **THEN** the system rejects the request

#### Scenario: Unauthenticated user cannot access the moderation queue
- **WHEN** an unauthenticated request is made to the moderation queue
- **THEN** the system rejects the request