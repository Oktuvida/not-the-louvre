### Requirement: Nickname-based account registration
The system SHALL allow a visitor to create an account using a unique nickname and password instead of an email address. During successful signup, the system SHALL normalize the nickname to lowercase, create the credential and session records required by the auth engine, create the companion product user record, assign the default role `user`, generate a recovery key, persist only its hash, and return the raw recovery key exactly once for user confirmation.

#### Scenario: Successful signup with valid nickname
- **WHEN** a visitor submits a nickname that matches the allowed format, is not already claimed, and provides a valid password
- **THEN** the system creates the account, signs the visitor into a new session, persists the product user record with normalized lowercase nickname and default `user` role, and returns a newly generated recovery key exactly once

#### Scenario: Rejected signup with duplicate nickname
- **WHEN** a visitor submits a nickname that is already claimed after normalization
- **THEN** the system rejects the signup and does not create auth or product identity records

#### Scenario: Rejected signup with invalid nickname format
- **WHEN** a visitor submits a nickname that violates the 3-20 character alphanumeric-plus-underscore rule after normalization
- **THEN** the system rejects the signup and explains that the nickname format is invalid

### Requirement: Nickname availability lookup
The system SHALL expose a backend capability to check whether a nickname is available for registration using the same normalization and validation rules as signup.

#### Scenario: Available nickname
- **WHEN** a client checks a nickname that is valid after normalization and is not already claimed
- **THEN** the system reports that the nickname is available

#### Scenario: Unavailable nickname
- **WHEN** a client checks a nickname that is already claimed after normalization
- **THEN** the system reports that the nickname is unavailable

#### Scenario: Invalid nickname for availability check
- **WHEN** a client checks a nickname that does not satisfy the nickname format rules
- **THEN** the system reports the nickname as invalid rather than available

### Requirement: Nickname-based login and logout
The system SHALL authenticate users by nickname and password, using the normalized nickname to resolve the backing auth identity. The system SHALL also provide logout behavior that invalidates the current authenticated session.

#### Scenario: Successful login with nickname and password
- **WHEN** a user submits a claimed nickname and the correct password
- **THEN** the system creates or resumes an authenticated session for that user

#### Scenario: Failed login with wrong password
- **WHEN** a user submits a claimed nickname and an incorrect password
- **THEN** the system rejects the login without revealing whether the failure was caused by the nickname or the password

#### Scenario: Successful logout
- **WHEN** an authenticated user requests logout
- **THEN** the system invalidates the current session so subsequent authenticated requests are no longer authorized by that session

### Requirement: Canonical authenticated product identity
The system SHALL resolve authenticated requests to a canonical product identity that combines auth-session state with the application-owned user record. This canonical identity SHALL include the product user id, auth user id, normalized nickname, and role so later backend capabilities can enforce ownership and authorization consistently.

#### Scenario: Authenticated request with companion product user
- **WHEN** an incoming request carries a valid authenticated session and the corresponding product user record exists
- **THEN** the system exposes the canonical authenticated product identity to server-side request handling

#### Scenario: Authenticated session without companion product user
- **WHEN** an incoming request carries a valid auth session but no companion product user record exists
- **THEN** the system treats the request as an identity integrity failure and does not expose a partial authenticated product identity to product code

### Requirement: Recovery-key password reset with rotation
The system SHALL allow account recovery by normalized nickname plus recovery key. On successful recovery, the system SHALL set the new password through the auth engine, generate a new recovery key, replace the stored recovery hash, and return the new raw recovery key exactly once.

#### Scenario: Successful account recovery
- **WHEN** a user submits a claimed nickname, a matching recovery key, and a valid new password
- **THEN** the system updates the password, replaces the stored recovery hash with a hash of a newly generated recovery key, and returns the new raw recovery key exactly once

#### Scenario: Failed recovery with invalid recovery key
- **WHEN** a user submits a claimed nickname and a recovery key that does not match the stored recovery hash
- **THEN** the system rejects the recovery attempt without changing the password or rotating the stored recovery hash

#### Scenario: Old recovery key invalid after successful rotation
- **WHEN** a recovery attempt succeeds and later someone retries recovery using the previous recovery key
- **THEN** the system rejects the old recovery key as invalid

### Requirement: Role and RBAC foundations
The system SHALL persist a role for every product user and make that role available through the canonical authenticated product identity. This change SHALL establish the structural foundation for RBAC without requiring moderator or admin management workflows in the same spec.

#### Scenario: New account receives default role
- **WHEN** a visitor successfully creates a new account
- **THEN** the system assigns the default product role `user`

#### Scenario: Authenticated request carries role information
- **WHEN** server-side code resolves an authenticated product identity
- **THEN** the resolved identity includes the user's current persisted role for downstream authorization checks

### Requirement: Abuse protection for auth-sensitive flows
The system SHALL enforce rate limits for failed login attempts and failed recovery attempts using durable server-side state so the protections remain effective across process restarts and multiple app instances.

#### Scenario: Too many failed login attempts
- **WHEN** requests from the same protected actor exceed the allowed failed login threshold within the configured window
- **THEN** the system temporarily rejects further login attempts for that actor until the cooldown window expires

#### Scenario: Too many failed recovery attempts
- **WHEN** requests from the same protected actor exceed the allowed failed recovery threshold within the configured window
- **THEN** the system temporarily rejects further recovery attempts for that actor until the cooldown window expires

#### Scenario: Durable auth abuse protection
- **WHEN** the application process restarts after failed-attempt counters have already been recorded within an active limit window
- **THEN** the system continues enforcing the active limit window instead of resetting the counters to zero
