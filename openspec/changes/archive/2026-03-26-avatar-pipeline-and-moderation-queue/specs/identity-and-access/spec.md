## MODIFIED Requirements

### Requirement: Canonical authenticated product identity
The system SHALL resolve authenticated requests to a canonical product identity that combines auth-session state with the application-owned user record. This canonical identity SHALL include the product user id, auth user id, normalized nickname, role, and avatar state so later backend capabilities can enforce ownership, authorization, and avatar resolution consistently.

#### Scenario: Authenticated request with companion product user
- **WHEN** an incoming request carries a valid authenticated session and the corresponding product user record exists
- **THEN** the system exposes the canonical authenticated product identity to server-side request handling, including the current avatar storage reference if one exists

#### Scenario: Authenticated session without companion product user
- **WHEN** an incoming request carries a valid auth session but no companion product user record exists
- **THEN** the system treats the request as an identity integrity failure and does not expose a partial authenticated product identity to product code
