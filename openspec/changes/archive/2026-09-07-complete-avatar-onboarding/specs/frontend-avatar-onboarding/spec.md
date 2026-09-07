## ADDED Requirements

### Requirement: Home signup avatar step persists a real avatar before onboarding completes
The system SHALL require the home-route avatar onboarding step to persist a real avatar through the backend avatar capability before the staged signup flow is considered complete.

#### Scenario: Successful avatar save completes onboarding
- **WHEN** a newly signed-up authenticated user reaches the avatar sketch step, submits a valid avatar payload, and the backend accepts it
- **THEN** the system persists the avatar, marks onboarding complete for that user, and transitions the home experience into the signed-in scene

#### Scenario: Avatar save failure keeps the user in onboarding
- **WHEN** a newly signed-up authenticated user submits avatar media and the backend rejects or fails the save
- **THEN** the system keeps the user in the avatar onboarding step, preserves the current sketch, and shows a retryable failure state instead of entering the signed-in scene

### Requirement: Avatar onboarding resumes safely for authenticated users with incomplete completion state
The system SHALL restore the avatar onboarding step for authenticated home-route users whose signup session exists but whose avatar onboarding completion state is still incomplete.

#### Scenario: Reload resumes incomplete avatar onboarding
- **WHEN** an authenticated user reloads the home route after signup but before avatar onboarding has completed
- **THEN** the system resolves the request as authenticated, reopens the avatar onboarding step, and does not drop the user into the fully completed inside scene

#### Scenario: Completed onboarding bypasses avatar step on later visits
- **WHEN** an authenticated user with completed avatar onboarding returns to the home route later
- **THEN** the system enters the normal signed-in home scene without reopening the avatar onboarding step

### Requirement: Avatar onboarding handles unsupported export and retry in place
The system SHALL surface product-facing avatar export and upload problems inside the home onboarding step without dead-ending the user.

#### Scenario: Browser cannot produce a valid avatar payload
- **WHEN** the avatar sketch step cannot export the drawing into a backend-acceptable avatar payload
- **THEN** the system keeps the user in the avatar onboarding step and shows a visible save error with retry guidance

#### Scenario: User retries avatar save after an in-place failure
- **WHEN** the avatar step has shown a save failure and the user tries again with the current or updated sketch
- **THEN** the system performs another avatar save attempt without requiring the user to restart signup
