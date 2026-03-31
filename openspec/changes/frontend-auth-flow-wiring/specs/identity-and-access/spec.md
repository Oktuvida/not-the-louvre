## ADDED Requirements

### Requirement: Product auth entry bootstraps from canonical session state
The system SHALL resolve the product home auth experience from canonical server auth state on page load so the frontend does not invent signed-in identity separately from the backend session contract.

#### Scenario: Existing authenticated session enters the home route as signed in
- **WHEN** a request to the home route carries a valid authenticated product session with a companion product user
- **THEN** the system renders the home experience from that canonical authenticated identity and bypasses the signed-out auth entry flow

#### Scenario: Signed-out request enters the home route as a visitor
- **WHEN** a request to the home route does not carry a valid authenticated product session
- **THEN** the system renders the signed-out visitor entry state and does not expose signed-in identity chrome

### Requirement: Product auth entry handles integrity failure safely
The system SHALL prevent the product auth entry flow from rendering a partial signed-in state when request auth resolution produces an integrity failure.

#### Scenario: Authenticated session missing companion product user on the home route
- **WHEN** a request to the home route carries a valid auth session but no companion product user record exists
- **THEN** the system renders a safe auth error state and withholds the normal signed-in experience until the integrity issue is resolved
