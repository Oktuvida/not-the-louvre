## ADDED Requirements

### Requirement: Public user profile read
The system SHALL expose a public user profile for any existing user, returning the user's nickname, avatar serving URL, role, and account creation date. Sensitive fields (recovery hash, auth user ID, email) SHALL NOT be included.

#### Scenario: Profile found for existing user
- **WHEN** a client requests the profile for a user ID that exists
- **THEN** the system returns the user's nickname, avatar URL (resolved to the serving endpoint or null), role, and creation date

#### Scenario: Profile not found for nonexistent user
- **WHEN** a client requests the profile for a user ID that does not exist
- **THEN** the system returns a not-found response

### Requirement: Public user profile does not require authentication
The system SHALL serve public user profiles without requiring an authenticated session, so that unauthenticated visitors can view author information.

#### Scenario: Unauthenticated profile access succeeds
- **WHEN** an unauthenticated client requests a user profile
- **THEN** the system returns the profile without requiring authentication
