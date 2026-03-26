## 1. Artwork schema and persistence foundation

- [x] 1.1 Add the initial `artworks` application schema and any narrow supporting persistence needed for publish-rate limiting
- [x] 1.2 Generate and review the Drizzle migration set for artwork persistence and related constraints
- [x] 1.3 Add schema-level tests or validation coverage for artwork ownership references and required artwork fields

## 2. Media policy and storage integration

- [x] 2.1 Implement server-side validation for artwork publish inputs, including title rules and media contract checks for AVIF and maximum size budget
- [x] 2.2 Implement storage integration for artwork media writes using stable, ownership-aware storage keys instead of persisted public bucket URLs
- [x] 2.3 Implement compensating cleanup for cases where media upload succeeds but artwork record creation fails

## 3. Artwork lifecycle services and routes

- [x] 3.1 Implement the authenticated artwork publish service that coordinates auth context, validation, storage persistence, and artwork record creation
- [x] 3.2 Implement author-only artwork title update behavior with ownership enforcement
- [x] 3.3 Implement author-only artwork deletion behavior with storage cleanup or invalidation aligned to the chosen deletion policy
- [x] 3.4 Add publish-specific abuse protection for repeated artwork publish attempts within the configured window

## 4. Verification and integration coverage

- [x] 4.1 Add integration tests for successful artwork publishing and unauthenticated publish rejection
- [x] 4.2 Add integration tests for invalid media rejection, including wrong format and oversized payload cases
- [x] 4.3 Add integration tests for title update and deletion ownership rules
- [x] 4.4 Add integration tests for partial publish failure cleanup and publish rate limiting behavior
