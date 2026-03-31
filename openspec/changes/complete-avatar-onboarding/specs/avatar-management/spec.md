## MODIFIED Requirements

### Requirement: Authenticated avatar upload
The system SHALL allow an authenticated product user to upload an avatar image that replaces any previously stored avatar. The uploaded image MUST be sanitized by the backend into the canonical persisted avatar representation, MUST satisfy the configured maximum avatar size budget after sanitization, and on success the system SHALL persist the avatar storage reference on the user profile, update any product-owned avatar onboarding completion state, and make the resulting avatar state resolvable through the canonical product identity.

#### Scenario: Successful avatar upload with sanitized valid AVIF image
- **WHEN** an authenticated user submits avatar media that satisfies the avatar upload contract
- **THEN** the system sanitizes the media into the canonical persisted avatar representation, stores the sanitized avatar image, updates the user profile with the new avatar storage reference, marks avatar onboarding complete when this upload is part of onboarding, and returns the updated profile state

#### Scenario: Avatar upload rejected for unauthenticated requester
- **WHEN** an avatar upload request is made without an authenticated product user
- **THEN** the system rejects the request and does not persist any storage, profile, or onboarding-state changes

#### Scenario: Avatar upload rejected for non-AVIF media
- **WHEN** an authenticated user submits avatar media that is not AVIF
- **THEN** the system rejects the upload and does not persist any storage, profile, or onboarding-state changes

#### Scenario: Avatar upload rejected for oversized sanitized output
- **WHEN** an authenticated user submits avatar media that cannot be sanitized into a canonical avatar output within the configured maximum avatar size budget
- **THEN** the system rejects the upload and does not persist any storage, profile, or onboarding-state changes
