## MODIFIED Requirements

### Requirement: Authenticated artwork publishing
The system SHALL allow an authenticated product user to publish a new artwork by submitting compliant artwork media and optional title metadata through the application backend. On success, the system SHALL persist a backend-sanitized artwork record with its author ownership and storage reference.

#### Scenario: Successful publish with sanitized valid media and title
- **WHEN** an authenticated user submits compliant artwork media and a valid optional title
- **THEN** the system sanitizes the media into the canonical persisted artwork representation, stores that sanitized media, creates the artwork record owned by that user, and returns the persisted artwork identity and metadata needed by the application

#### Scenario: Publish rejected for unauthenticated requester
- **WHEN** a request to publish artwork is made without an authenticated product user
- **THEN** the system rejects the request and does not create storage or database records

### Requirement: Artwork media contract enforcement
The system SHALL enforce the persisted artwork media contract at the backend boundary. Persisted artwork media MUST be backend-sanitized AVIF, MUST decode successfully as a single still image, MUST match the configured canonical artwork dimensions, MUST satisfy the configured maximum size budget for stored images after sanitization, and MUST not retain client-provided metadata outside the canonical persisted representation.

#### Scenario: Publish sanitizes canonical artwork media before storage
- **WHEN** an authenticated user submits artwork media that satisfies the artwork upload contract
- **THEN** the system decodes the upload, re-encodes a canonical AVIF output for persistence, and stores only the backend-generated sanitized media bytes

#### Scenario: Publish rejected for non-AVIF media
- **WHEN** an authenticated user submits artwork media that is not AVIF
- **THEN** the system rejects the publish request and does not persist the artwork

#### Scenario: Publish rejected for undecodable or malformed AVIF media
- **WHEN** an authenticated user submits artwork media whose AVIF container or pixel payload cannot be decoded safely into the canonical artwork image
- **THEN** the system rejects the publish request and does not persist the artwork

#### Scenario: Publish rejected for non-canonical artwork dimensions
- **WHEN** an authenticated user submits artwork media whose decoded dimensions do not match the configured canonical artwork dimensions
- **THEN** the system rejects the publish request and does not persist the artwork

#### Scenario: Publish rejected when sanitized output exceeds budget
- **WHEN** an authenticated user submits artwork media that cannot be sanitized into a canonical AVIF output within the configured maximum stored-image budget
- **THEN** the system rejects the publish request and does not persist the artwork