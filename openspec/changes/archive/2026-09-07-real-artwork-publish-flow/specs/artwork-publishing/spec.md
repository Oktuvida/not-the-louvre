## MODIFIED Requirements

### Requirement: Authenticated artwork publishing
The system SHALL allow an authenticated product user to publish a new artwork by submitting compliant artwork media and optional title metadata through the application backend. On success, the system SHALL persist a backend-sanitized artwork record with its author ownership and storage reference. Product-owned publishing surfaces such as the draw route MAY submit a supported source image format that is not already canonical AVIF, provided the backend still sanitizes it into the canonical persisted artwork representation before storage. For the draw route, the preferred browser-export source order SHALL be WebP first, JPEG second, and PNG only as the final fallback.

#### Scenario: Successful publish with sanitized valid media and title
- **WHEN** an authenticated user submits compliant artwork media and a valid optional title
- **THEN** the system sanitizes the media into the canonical persisted artwork representation, stores that sanitized media, creates the artwork record owned by that user, and returns the persisted artwork identity and metadata needed by the application

#### Scenario: Product draw route publishes browser-exported source media successfully
- **WHEN** an authenticated user submits a supported source image exported from the product draw route using the available browser fallback order
- **THEN** the system sanitizes that source media into the canonical persisted artwork representation, stores the canonical output, and returns the created artwork identity to the product flow

#### Scenario: Publish rejected for unauthenticated requester
- **WHEN** a request to publish artwork is made without an authenticated product user
- **THEN** the system rejects the request and does not create storage or database records

### Requirement: Artwork media contract enforcement
The system SHALL enforce the persisted artwork media contract at the backend boundary. Persisted artwork media MUST be backend-sanitized AVIF, MUST decode successfully as a single still image, MUST match the configured canonical artwork dimensions, MUST satisfy the configured maximum size budget for stored images after sanitization, and MUST not retain client-provided metadata outside the canonical persisted representation. The backend MAY accept explicitly supported non-AVIF source media from product-owned creation surfaces if that media can be safely decoded and sanitized into the canonical persisted artwork output. For the draw route, the explicitly supported browser-export source formats SHALL include WebP, JPEG, and PNG.

#### Scenario: Publish sanitizes canonical artwork media before storage
- **WHEN** an authenticated user submits artwork media that satisfies the artwork upload contract
- **THEN** the system decodes the upload, re-encodes a canonical AVIF output for persistence, and stores only the backend-generated sanitized media bytes

#### Scenario: Product draw route source media is normalized into canonical persisted artwork media
- **WHEN** an authenticated user submits supported non-AVIF source media from the product draw route
- **THEN** the system decodes that source media, re-encodes a canonical AVIF output for persistence, and stores only the backend-generated sanitized media bytes

#### Scenario: Draw route prefers smaller browser-export formats before PNG fallback
- **WHEN** the draw route exports canvas media for publish
- **THEN** the product flow tries WebP first, JPEG second, and PNG only if the earlier browser export formats are unavailable

#### Scenario: Publish rejected for unsupported source media
- **WHEN** an authenticated user submits media that is neither canonical AVIF nor an explicitly supported source format for the active product flow
- **THEN** the system rejects the publish request and does not persist the artwork

#### Scenario: Publish rejected for undecodable or malformed source media
- **WHEN** an authenticated user submits media whose container or pixel payload cannot be decoded safely into the canonical artwork image
- **THEN** the system rejects the publish request and does not persist the artwork

#### Scenario: Publish rejected for non-canonical artwork dimensions after normalization
- **WHEN** an authenticated user submits source media whose decoded content cannot be normalized into the configured canonical artwork dimensions
- **THEN** the system rejects the publish request and does not persist the artwork

#### Scenario: Publish rejected when sanitized output exceeds budget
- **WHEN** an authenticated user submits artwork media that cannot be sanitized into a canonical AVIF output within the configured maximum stored-image budget
- **THEN** the system rejects the publish request and does not persist the artwork
