## ADDED Requirements

### Requirement: Moderator report queue listing
The system SHALL allow authenticated moderators to query a list of reported content pending review. The listing SHALL include both reported artworks and reported comments, ordered by active report count descending, with enough target context for the moderator to take action.

#### Scenario: Moderator lists pending reported content
- **WHEN** an authenticated moderator requests the moderation queue
- **THEN** the system returns reported artworks and comments ordered by active report count descending, including target identity, content summary, author information, report count, and hidden state

#### Scenario: Moderation queue excludes content with zero reports
- **WHEN** the moderation queue is requested and some content has had all its reports resolved or the content was deleted
- **THEN** the system excludes content with zero active reports from the queue results

#### Scenario: Non-moderator cannot access the moderation queue
- **WHEN** an authenticated user without moderator privileges requests the moderation queue
- **THEN** the system rejects the request

#### Scenario: Unauthenticated user cannot access the moderation queue
- **WHEN** an unauthenticated request is made to the moderation queue
- **THEN** the system rejects the request

### Requirement: Moderation queue pagination
The system SHALL support paginated access to the moderation queue so moderators can work through large volumes of reported content incrementally.

#### Scenario: Paginated moderation queue with continuation
- **WHEN** a moderator requests the moderation queue with a page size smaller than total reported items
- **THEN** the system returns the requested page and indicates whether more items exist

#### Scenario: Moderation queue continuation from cursor
- **WHEN** a moderator requests the next page of the moderation queue using a continuation cursor
- **THEN** the system returns the next batch of reported items continuing from where the previous page ended
