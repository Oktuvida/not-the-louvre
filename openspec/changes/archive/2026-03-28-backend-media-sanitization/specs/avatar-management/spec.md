## MODIFIED Requirements

### Requirement: Authenticated avatar upload
The system SHALL allow an authenticated product user to upload an avatar image that replaces any previously stored avatar. The uploaded image MUST be sanitized by the backend into the canonical persisted avatar representation, MUST satisfy the configured maximum avatar size budget after sanitization, and on success the system SHALL persist the avatar storage reference on the user profile and make it resolvable through the canonical product identity.

#### Scenario: Successful avatar upload with sanitized valid AVIF image
- **WHEN** an authenticated user submits avatar media that satisfies the avatar upload contract
- **THEN** the system sanitizes the media into the canonical persisted avatar representation, stores the sanitized avatar image, updates the user profile with the new avatar storage reference, and returns the updated profile state

#### Scenario: Avatar upload rejected for unauthenticated requester
- **WHEN** an avatar upload request is made without an authenticated product user
- **THEN** the system rejects the request and does not persist any storage or profile changes

#### Scenario: Avatar upload rejected for non-AVIF media
- **WHEN** an authenticated user submits avatar media that is not AVIF
- **THEN** the system rejects the upload and does not persist any storage or profile changes

#### Scenario: Avatar upload rejected for oversized sanitized output
- **WHEN** an authenticated user submits avatar media that cannot be sanitized into a canonical avatar output within the configured maximum avatar size budget
- **THEN** the system rejects the upload and does not persist any storage or profile changes

### Requirement: Canonical avatar media sanitization
The system SHALL sanitize persisted avatar media at the backend boundary. Persisted avatar media MUST be backend-sanitized AVIF, MUST decode successfully as a single still image, MUST match the configured canonical avatar dimensions, and MUST not retain client-provided metadata outside the canonical persisted representation.

#### Scenario: Avatar upload stores only sanitized backend-generated media
- **WHEN** an authenticated user submits avatar media that satisfies the avatar upload contract
- **THEN** the system decodes the upload, re-encodes a canonical AVIF output for persistence, and stores only the backend-generated sanitized avatar media bytes

#### Scenario: Avatar upload rejected for undecodable or malformed AVIF media
- **WHEN** an authenticated user submits avatar media whose AVIF container or pixel payload cannot be decoded safely into the canonical avatar image
- **THEN** the system rejects the upload and does not persist any storage or profile changes

#### Scenario: Avatar upload rejected for non-canonical avatar dimensions
- **WHEN** an authenticated user submits avatar media whose decoded dimensions do not match the configured canonical avatar dimensions
- **THEN** the system rejects the upload and does not persist any storage or profile changes