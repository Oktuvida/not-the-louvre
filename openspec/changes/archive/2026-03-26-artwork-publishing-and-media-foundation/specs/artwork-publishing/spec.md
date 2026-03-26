## ADDED Requirements

### Requirement: Authenticated artwork publishing
The system SHALL allow an authenticated product user to publish a new artwork by submitting compliant artwork media and optional title metadata through the application backend. On success, the system SHALL persist the artwork record with its author ownership and storage reference.

#### Scenario: Successful publish with valid media and title
- **WHEN** an authenticated user submits compliant artwork media and a valid optional title
- **THEN** the system stores the media, creates the artwork record owned by that user, and returns the persisted artwork identity and metadata needed by the application

#### Scenario: Publish rejected for unauthenticated requester
- **WHEN** a request to publish artwork is made without an authenticated product user
- **THEN** the system rejects the request and does not create storage or database records

### Requirement: Artwork media contract enforcement
The system SHALL enforce the persisted artwork media contract at the backend boundary. Persisted artwork media MUST be AVIF and MUST satisfy the configured maximum size budget for stored images.

#### Scenario: Publish rejected for non-AVIF media
- **WHEN** an authenticated user submits artwork media that is not AVIF
- **THEN** the system rejects the publish request and does not persist the artwork

#### Scenario: Publish rejected for oversized media
- **WHEN** an authenticated user submits artwork media that exceeds the configured maximum stored-image budget
- **THEN** the system rejects the publish request and does not persist the artwork

### Requirement: Stable storage-backed artwork references
The system SHALL persist a stable storage-backed media reference for each artwork rather than a deployment-specific public bucket URL. The persisted artwork reference SHALL be suitable for later application-controlled media delivery and cache-layer integration.

#### Scenario: Publish stores stable media reference
- **WHEN** an artwork is successfully published
- **THEN** the persisted artwork record stores a stable storage reference that is independent of any direct public bucket URL

### Requirement: Safe publish failure handling across storage and database persistence
The system SHALL handle partial publish failures so that media storage and database persistence do not drift silently. If media storage succeeds but artwork record creation fails, the system SHALL attempt compensating cleanup of the newly written media object before returning an error.

#### Scenario: Database failure after media upload
- **WHEN** artwork media storage succeeds but the artwork record cannot be persisted
- **THEN** the system attempts to remove the newly written media object and returns a safe publish failure response

### Requirement: Author-controlled artwork title updates
The system SHALL allow the author of an artwork to update its title after publishing, subject to the configured title validation rules.

#### Scenario: Author updates artwork title
- **WHEN** the author of an artwork submits a valid replacement title
- **THEN** the system updates the stored title for that artwork

#### Scenario: Non-author cannot update artwork title
- **WHEN** a user who does not own an artwork attempts to change its title
- **THEN** the system rejects the update and leaves the stored artwork unchanged

### Requirement: Author-controlled artwork deletion
The system SHALL allow the author of an artwork to delete that artwork through the application backend. Deletion SHALL remove or invalidate the storage-backed media reference according to the backend's deletion policy so the artwork is no longer available as active content.

#### Scenario: Author deletes artwork
- **WHEN** the author of an artwork requests deletion
- **THEN** the system removes the artwork from active content and applies the configured media cleanup or invalidation behavior

#### Scenario: Non-author cannot delete artwork
- **WHEN** a user who does not own an artwork attempts to delete it
- **THEN** the system rejects the deletion and leaves the artwork unchanged

### Requirement: Publish abuse protection
The system SHALL enforce server-side rate limiting for artwork publishing so repeated publish attempts from the same authenticated actor cannot exceed the configured publish budget window.

#### Scenario: Too many publish attempts within active window
- **WHEN** an authenticated user exceeds the configured publish threshold within the active publish window
- **THEN** the system temporarily rejects further publish attempts for that user until the limit window expires
