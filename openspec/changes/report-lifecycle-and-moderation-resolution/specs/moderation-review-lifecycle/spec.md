## ADDED Requirements

### Requirement: Reports carry explicit moderation lifecycle state
The system SHALL persist each moderation report with an explicit lifecycle state so the backend can distinguish active review work from already-resolved moderation history. Each resolved report SHALL record which moderator reviewed it when moderator attribution is available.

#### Scenario: New report starts as pending
- **WHEN** an authenticated user submits a valid new report for an artwork or comment target
- **THEN** the persisted report is created in the `pending` lifecycle state

#### Scenario: Moderator resolves report without content action
- **WHEN** an authenticated moderator dismisses the active reports for a moderation target as a false positive or no-action review
- **THEN** the target's pending reports transition to the `reviewed` lifecycle state with reviewer attribution recorded

#### Scenario: Moderator resolves report through content action
- **WHEN** an authenticated moderator hides or deletes a reported moderation target
- **THEN** the target's pending reports transition to the `actioned` lifecycle state with reviewer attribution recorded

### Requirement: Active reports are unique per reporter and target
The system SHALL allow at most one active pending report from the same reporter against the same moderation target at a time.

#### Scenario: Duplicate active artwork report is rejected
- **WHEN** a reporter submits a new report for an artwork target that already has a pending report from that same reporter
- **THEN** the system rejects the duplicate active report and does not create another pending row

#### Scenario: Duplicate active comment report is rejected
- **WHEN** a reporter submits a new report for a comment target that already has a pending report from that same reporter
- **THEN** the system rejects the duplicate active report and does not create another pending row

#### Scenario: Reporter can submit again after prior report is resolved
- **WHEN** a reporter previously had a report for a moderation target resolved and later submits a new valid report for that same target
- **THEN** the system accepts the new report as a new pending moderation signal

### Requirement: Target-level review decisions resolve pending reports atomically
The system SHALL apply moderator review outcomes to all currently pending reports for the reviewed target in one consistent backend transition so queue membership, active counts, and target state remain synchronized.

#### Scenario: Dismissal removes target from active review
- **WHEN** a moderator dismisses all pending reports for a target without mutating the target content
- **THEN** the system leaves the target content unchanged and removes that target from active queue results unless new pending reports arrive later

#### Scenario: Content action clears active report count for reviewed target
- **WHEN** a moderator action hides or deletes a target with pending reports
- **THEN** the system resolves the target's pending reports in the same review operation so they no longer count as active reports afterward
