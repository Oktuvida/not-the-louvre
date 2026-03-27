## ADDED Requirements

### Requirement: Authenticated avatar upload
The system SHALL allow an authenticated product user to upload an avatar image that replaces any previously stored avatar. The uploaded image MUST be AVIF format and MUST satisfy the configured maximum avatar size budget. On success, the system SHALL persist the avatar storage reference on the user profile and make it resolvable through the canonical product identity.

#### Scenario: Successful avatar upload with valid AVIF image
- **WHEN** an authenticated user submits an AVIF image that satisfies the avatar size budget
- **THEN** the system stores the image, updates the user profile with the new avatar storage reference, and returns the updated profile state

#### Scenario: Avatar upload rejected for unauthenticated requester
- **WHEN** an avatar upload request is made without an authenticated product user
- **THEN** the system rejects the request and does not persist any storage or profile changes

#### Scenario: Avatar upload rejected for non-AVIF media
- **WHEN** an authenticated user submits avatar media that is not AVIF
- **THEN** the system rejects the upload and does not persist any storage or profile changes

#### Scenario: Avatar upload rejected for oversized media
- **WHEN** an authenticated user submits avatar media that exceeds the configured maximum avatar size budget
- **THEN** the system rejects the upload and does not persist any storage or profile changes

### Requirement: Avatar replacement cleans up previous storage
The system SHALL remove or invalidate the previously stored avatar media object when a user uploads a replacement avatar, so abandoned avatar images do not accumulate in storage.

#### Scenario: Previous avatar removed on replacement upload
- **WHEN** an authenticated user uploads a new avatar and a previous avatar storage reference exists
- **THEN** the system removes the previous avatar media object from storage before or after persisting the new reference

#### Scenario: First avatar upload with no previous avatar
- **WHEN** an authenticated user uploads an avatar for the first time (no previous avatar exists)
- **THEN** the system stores the new avatar without attempting cleanup of a nonexistent previous object

### Requirement: Avatar media serving through application-controlled endpoint
The system SHALL serve avatar media through an application-controlled endpoint using the user identifier rather than exposing raw storage bucket paths. The endpoint SHALL resolve the avatar storage reference and return the image with appropriate cache headers.

#### Scenario: Avatar media served for user with avatar
- **WHEN** a client requests avatar media for a user who has an uploaded avatar
- **THEN** the system returns the avatar image with the correct content type and cache-friendly headers

#### Scenario: Avatar media not found for user without avatar
- **WHEN** a client requests avatar media for a user who has not uploaded an avatar
- **THEN** the system returns a not-found response

#### Scenario: Avatar media not found for nonexistent user
- **WHEN** a client requests avatar media for a user identifier that does not exist
- **THEN** the system returns a not-found response

### Requirement: Avatar deletion
The system SHALL allow an authenticated user to delete their own avatar, removing the stored media and clearing the avatar reference on the profile.

#### Scenario: Authenticated user deletes their avatar
- **WHEN** an authenticated user requests deletion of their avatar and a stored avatar exists
- **THEN** the system removes the avatar media from storage, clears the avatar reference on the profile, and returns the updated profile state

#### Scenario: Avatar deletion with no existing avatar
- **WHEN** an authenticated user requests avatar deletion but no avatar is currently stored
- **THEN** the system returns success without attempting storage cleanup
