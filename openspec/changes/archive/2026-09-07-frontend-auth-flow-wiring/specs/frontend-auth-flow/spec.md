## ADDED Requirements

### Requirement: Home auth overlay uses the real backend auth contract
The system SHALL wire the home-route auth overlay to the existing nickname-based backend auth actions so sign in, sign up, recovery, and sign out mutate real session state instead of mocked client state.

#### Scenario: Successful sign in from the home overlay
- **WHEN** a visitor opens the home auth overlay, submits a valid nickname and password, and the backend accepts the credentials
- **THEN** the system creates or resumes the real authenticated session and the home experience renders the signed-in state from canonical server auth data

#### Scenario: Successful sign up from the home overlay
- **WHEN** a visitor submits a valid available nickname and password through the home signup flow
- **THEN** the system creates the real account and session, displays the backend-issued one-time recovery key in the overlay, and keeps the user in the staged signup UI until they acknowledge it

#### Scenario: Successful recovery from the home overlay
- **WHEN** a visitor submits a valid nickname, recovery key, and replacement password through the home recovery flow
- **THEN** the system resets the password through the backend, displays the rotated replacement recovery key in the overlay, and returns the visitor to the login context when the recovery acknowledgement step is complete

### Requirement: Home auth overlay preserves context-specific auth feedback
The system SHALL keep the visitor inside the home auth overlay while surfacing backend-driven availability, validation, and failure states in the appropriate local context.

#### Scenario: Signup nickname availability reflects backend truth
- **WHEN** the signup flow checks nickname availability for a normalized valid nickname
- **THEN** the overlay reports whether that nickname is available, taken, or invalid using the same backend rules as signup

#### Scenario: Sign in failure stays in login context
- **WHEN** a visitor submits invalid login credentials from the home overlay
- **THEN** the system keeps the overlay in the login state and renders the backend failure message without entering the signed-in scene

#### Scenario: Rate-limited auth attempt stays recoverable in place
- **WHEN** a sign in or recovery attempt is rejected because the backend abuse limit is active
- **THEN** the system keeps the visitor in the current auth view and renders a visible cooldown message instead of closing or resetting the overlay

### Requirement: Home auth sign out clears real session state
The system SHALL let a signed-in home-route visitor sign out through the product UI and return to the signed-out entry state using the backend logout contract.

#### Scenario: Signed-in visitor logs out from the home scene
- **WHEN** an authenticated visitor activates sign out from the home route
- **THEN** the system invalidates the current backend session and the next rendered home state is the signed-out visitor experience
