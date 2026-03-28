## ADDED Requirements

### Requirement: Cookie-backed state-changing requests are origin-hardened
The system SHALL reject unsafe state-changing backend requests that do not demonstrate trusted same-origin intent when those requests rely on cookie-backed session authority.

#### Scenario: Trusted same-origin mutation proceeds
- **WHEN** a client sends a state-changing backend request with trusted same-origin request metadata
- **THEN** the system allows the request to continue to normal authentication, authorization, and domain handling

#### Scenario: Unsafe cross-site mutation is rejected
- **WHEN** a state-changing backend request arrives without trusted same-origin request metadata and would otherwise rely on cookie-backed authority
- **THEN** the system rejects the request before product mutation logic runs

### Requirement: Security-relevant backend denials are operationally visible
The system SHALL emit structured backend log events for security-relevant failures that materially affect request trust decisions or security posture.

#### Scenario: Integrity failure is logged
- **WHEN** a request resolves to an auth integrity failure because a valid auth session lacks its required companion product user state
- **THEN** the system emits a structured backend log event describing the integrity failure without exposing sensitive secrets

#### Scenario: Unsafe mutation rejection is logged
- **WHEN** the backend rejects a state-changing request for failing the trusted-origin safety policy
- **THEN** the system emits a structured backend log event describing the rejection context

#### Scenario: Auth abuse protection denial is logged
- **WHEN** a login or recovery attempt is denied because an active server-side auth abuse limit is in effect
- **THEN** the system emits a structured backend log event describing the denial context