## ADDED Requirements

### Requirement: Authenticated users can publish artwork from the draw route
The system SHALL allow an authenticated product user to publish the current draw-route canvas as a real artwork through the product route flow rather than a local-only UI action.

#### Scenario: Authenticated draw publish succeeds
- **WHEN** an authenticated user exports the current draw canvas and submits it from `/draw`
- **THEN** the system persists a real artwork through the backend and returns product-facing success state with the persisted artwork identity

#### Scenario: Unauthenticated user cannot use the draw publish flow
- **WHEN** a request reaches the draw route without a valid authenticated product user
- **THEN** the system does not expose a publishable draw flow and redirects or resolves the route according to the active auth-entry policy

### Requirement: Draw-route publish failures are surfaced in place
The system SHALL keep the user on the draw route and show product-facing failure state when draw publish fails.

#### Scenario: Backend publish validation fails
- **WHEN** the draw route submits exported artwork media and the backend rejects the publish request
- **THEN** the system keeps the user on `/draw`, preserves the current drawing, and exposes the backend failure message and code for retry

#### Scenario: Browser export fails before submit
- **WHEN** the draw route cannot export the current canvas into a supported upload payload
- **THEN** the system does not submit a publish request and shows a local retryable export failure on the draw route

### Requirement: Successful draw publish ends in a clear usable state
The system SHALL leave the user in a clear post-publish state after a successful draw-route publish.

#### Scenario: User receives a durable success result after publish
- **WHEN** draw-route publish succeeds
- **THEN** the system shows a product-facing success outcome that confirms the artwork was created and exposes the persisted artwork identity or next action options
