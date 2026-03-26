## MODIFIED Requirements

### Requirement: Authenticated artwork publishing
The system SHALL allow an authenticated product user to publish a new artwork by submitting compliant artwork media and optional title metadata through the application backend. On success, the system SHALL persist the artwork record with its author ownership and storage reference. The publish flow SHALL also allow the caller to declare that the new artwork is a fork of an existing active parent artwork.

#### Scenario: Successful publish with valid media and title
- **WHEN** an authenticated user submits compliant artwork media and a valid optional title
- **THEN** the system stores the media, creates the artwork record owned by that user, and returns the persisted artwork identity and metadata needed by the application

#### Scenario: Publish rejected for unauthenticated requester
- **WHEN** a request to publish artwork is made without an authenticated product user
- **THEN** the system rejects the request and does not create storage or database records

#### Scenario: Successful fork publish with valid parent reference
- **WHEN** an authenticated user submits compliant artwork media and declares an existing active parent artwork to fork
- **THEN** the system stores the media, creates the child artwork record owned by that user, and persists its association to the declared parent artwork

#### Scenario: Publish rejected for invalid fork parent reference
- **WHEN** an authenticated user submits compliant artwork media but declares a parent artwork that does not exist as active content
- **THEN** the system rejects the publish request and does not create storage or database records for the fork
