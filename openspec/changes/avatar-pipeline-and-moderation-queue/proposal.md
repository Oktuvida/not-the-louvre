## Why

The backend now covers identity, publishing, discovery, social interactions, fork lineage, ranked feeds, and community reporting with auto-hide and moderator actions. Two explicit PRD gaps remain before the backend roadmap is feature-complete for MVP: users have no way to upload, persist, or serve hand-drawn avatars (§5.2 requires avatars displayed alongside every artwork, comment, and feed card), and moderators have no way to query pending reports as a reviewable queue (§8.3 requires a moderation queue sorted by report count). Both are bounded, well-understood capabilities that close the remaining PRD backend gaps without touching client-side concerns like NSFWJS or realtime delivery.

## What Changes

- Introduce a backend avatar upload pipeline so authenticated users can upload, replace, and serve hand-drawn avatars through application-controlled media endpoints, subject to the same AVIF format and size-budget enforcement used by artwork publishing.
- Persist avatar storage references on the user profile and serve avatar media through a cached, application-controlled URL rather than exposing raw bucket paths.
- Add a moderation queue query surface so authenticated moderators can list pending reported content (artworks and comments) ordered by active report count, with enough context to take hide/unhide/delete actions using the existing moderation endpoints.
- Enforce moderator authorization for queue reads while keeping the existing report submission and moderation action boundaries unchanged.

## Capabilities

### New Capabilities
- `avatar-management`: Avatar upload, replacement, storage persistence, media serving, format/size enforcement, and cache-friendly delivery for user profile images.
- `moderation-queue`: Query surface for moderators to list reported content pending review, sorted by report count, with target context and action affordances.

### Modified Capabilities
- `identity-and-access`: The canonical authenticated product identity expands to include avatar state so downstream services and read models can resolve avatar media URLs consistently.

## Impact

- Affected code: `apps/web/src/lib/server/db/schema.ts` (avatar storage fields if needed), avatar upload/serve service and route handlers, moderation queue read service and route handler, user profile types, and backend integration tests.
- Affected systems: Supabase Storage (avatar bucket or shared bucket with avatar prefix), media validation pipeline (reuse AVIF/size-budget enforcement), and moderator authorization checks.
- Dependencies: `identity-and-access` for canonical user identity and avatar_url field, `artwork-publishing` for the established media validation and storage patterns, `community-reporting` for report persistence and moderator role checks.
- Follow-on work unlocked: avatar display in all UI surfaces (feed cards, detail views, comments), moderator dashboard frontend, and the full onboarding flow from the PRD (§4.1).
