## ADDED Requirements

### Requirement: Minimal demo surfaces drive backend user journeys
The system SHALL expose intentionally minimal browser-accessible demo routes under `/demo` that allow end-to-end tests to drive real backend flows without depending on production-grade UI. These routes SHALL use stable form inputs, actions, and visible result states so both humans and Playwright can verify backend outcomes.

#### Scenario: Demo route exercises a real backend flow
- **WHEN** a browser-based test uses a `/demo` route to submit a supported user action
- **THEN** the route drives the same backend boundary used by the running application and renders the resulting success or failure state for verification

#### Scenario: Demo route remains intentionally minimal
- **WHEN** a new backend journey is exposed for end-to-end coverage
- **THEN** the system provides only the smallest frontend surface needed to perform the action and inspect the outcome rather than building polished product UI

### Requirement: Backend e2e journeys start from deterministic state
The system SHALL provide a repeatable test-only mechanism to prepare or reset backend state for end-to-end journeys so local and CI runs can execute from known conditions.

#### Scenario: Playwright run prepares known state
- **WHEN** an end-to-end test begins under the Playwright runtime
- **THEN** the system can prepare or reset the required backend state through a guarded deterministic setup path before the user journey assertions execute

#### Scenario: Test-only setup remains unavailable in normal runtime
- **WHEN** the application is running outside the dedicated end-to-end test runtime
- **THEN** the deterministic setup or reset mechanism is not available as a normal user-facing capability

### Requirement: Authentication journey is covered through the real browser runtime
The system SHALL support an end-to-end journey that verifies nickname-based signup, login, logout, availability checking, and recovery through the running SvelteKit application using browser navigation and persisted session cookies.

#### Scenario: Visitor completes the auth journey
- **WHEN** a visitor goes through the supported authentication demo flow with valid inputs
- **THEN** the browser journey proves nickname availability, account creation, authenticated session establishment, logout, recovery, and subsequent login with the rotated password through the real app runtime

### Requirement: One authenticated artwork journey proves the cross-domain pattern
The system SHALL support at least one authenticated artwork-focused end-to-end journey through a minimal demo surface so the backend test pattern is proven beyond authentication alone.

#### Scenario: Authenticated user completes the first artwork journey
- **WHEN** an authenticated user performs the supported artwork flow through the demo surface
- **THEN** the system persists the backend change and renders the resulting read state so the test can verify the user-visible outcome through the running application