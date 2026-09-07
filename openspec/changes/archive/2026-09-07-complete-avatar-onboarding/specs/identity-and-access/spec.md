## MODIFIED Requirements

### Requirement: Canonical authenticated product identity
The system SHALL resolve authenticated requests to a canonical product identity that combines auth-session state with the application-owned user record. This canonical identity SHALL include the product user id, auth user id, normalized nickname, role, avatar state, and any product-owned onboarding completion state needed to resume or bypass authenticated onboarding surfaces consistently. Requests backed by expired or otherwise invalid auth sessions SHALL resolve without authenticated product identity, while valid auth sessions missing their companion product user record SHALL remain integrity failures.

#### Scenario: Authenticated request with companion product user
- **WHEN** an incoming request carries a valid authenticated session and the corresponding product user record exists
- **THEN** the system exposes the canonical authenticated product identity to server-side request handling, including the current avatar storage reference if one exists and the current onboarding completion state if one is tracked

#### Scenario: Expired or invalid session does not produce authenticated identity
- **WHEN** an incoming request carries an expired or otherwise invalid auth session
- **THEN** the system does not expose authenticated product identity to product code and treats the request as unauthenticated for downstream authorization

#### Scenario: Authenticated session without companion product user
- **WHEN** an incoming request carries a valid auth session but no companion product user record exists
- **THEN** the system treats the request as an identity integrity failure and does not expose a partial authenticated product identity to product code
