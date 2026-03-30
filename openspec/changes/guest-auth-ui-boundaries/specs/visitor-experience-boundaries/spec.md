## ADDED Requirements

### Requirement: Signed-out visitors see a read-only home landing experience
The system SHALL present signed-out visitors with a home experience that does not expose authenticated-only world navigation affordances or transitions to private destinations such as the personal studio.

#### Scenario: Guest lands on home
- **WHEN** a signed-out visitor opens the home route
- **THEN** the rendered home experience does not show authenticated-only navigation affordances for private destinations or private route transitions

#### Scenario: Authenticated user lands on home
- **WHEN** an authenticated user opens the home route
- **THEN** the system preserves the authenticated home affordances that lead into the gallery and studio flows available to that user

### Requirement: Signed-out visitors see only public gallery rooms and calls to action
The system SHALL present signed-out visitors with public gallery navigation only, and SHALL not expose personal-room or creation calls to action that require authentication.

#### Scenario: Guest opens gallery navigation
- **WHEN** a signed-out visitor opens the gallery
- **THEN** the visible room navigation excludes `Your Studio` and any create-art entry point that requires authentication

#### Scenario: Authenticated user opens gallery navigation
- **WHEN** an authenticated user opens the gallery
- **THEN** the visible gallery navigation includes the authenticated-only personal room and creation entry points available to that user

#### Scenario: Guest requests personal gallery room directly
- **WHEN** a signed-out visitor requests the `Your Studio` gallery room by URL
- **THEN** the system does not present that personal room as a normal visitor destination and instead responds with the configured signed-out handling for private gallery space

### Requirement: Signed-out visitors see read-only artwork detail
The system SHALL present artwork detail to signed-out visitors without authenticated-only interaction controls, while preserving visible artwork metadata and comments that are allowed for public discovery.

#### Scenario: Guest opens artwork detail
- **WHEN** a signed-out visitor opens artwork detail from a public gallery surface
- **THEN** the detail view shows the artwork information in read-only form without vote, comment, or fork controls

#### Scenario: Authenticated user opens artwork detail
- **WHEN** an authenticated user opens artwork detail from a public gallery surface
- **THEN** the detail view includes the interaction controls allowed for authenticated users

### Requirement: Signed-out empty states and prompts reflect visitor status
The system SHALL render guest-visible prompts and empty states using visitor-appropriate copy, and SHALL not tell signed-out visitors to use private spaces they cannot access yet.

#### Scenario: Guest encounters a gated gallery surface
- **WHEN** a signed-out visitor reaches a gallery surface that would otherwise reference personal publishing or studio ownership
- **THEN** the UI uses visitor-appropriate messaging or sign-in prompts instead of assuming the visitor already has a studio

#### Scenario: Authenticated user encounters an empty personal gallery surface
- **WHEN** an authenticated user reaches their empty personal gallery surface
- **THEN** the UI may guide that user toward the studio or other authenticated publishing flows available to them
