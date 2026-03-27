## Context

The backend has a mature media pipeline for artworks: AVIF validation, size-budget enforcement, stable storage keys, application-controlled media endpoints, and compensating cleanup on failure. Avatars need the same treatment but at a smaller scale (256x256, ~100KB budget per the PRD §5.2). The `avatar_url` field already exists on the `users` table but stores no structured storage reference — it is currently nullable with no upload flow behind it.

Separately, the community-reporting-and-auto-hide change established report persistence, auto-hide thresholds, and moderator hide/unhide/delete actions, but left out the query surface that lets moderators discover which content is reported. The moderation queue needs to aggregate report counts across artworks and comments and present them as a unified, paginated list.

## Goals / Non-Goals

**Goals:**
- Add avatar upload, replacement, deletion, and serving through the established media pipeline patterns.
- Reuse the existing AVIF validation and storage abstraction from artwork publishing.
- Serve avatars through a cache-friendly application-controlled endpoint, not raw bucket URLs.
- Add a moderation queue read model that lists reported artworks and comments ordered by report count.
- Support pagination on the moderation queue.
- Enforce moderator authorization on queue access.
- Lock both capabilities down with automated tests.

**Non-Goals:**
- Avatar resizing or transcoding on the server (the client is responsible for producing compliant 256x256 AVIF).
- Avatar templates, face guides, or drawing tools (those are frontend/canvas concerns).
- Moderation workflow states beyond what already exists (pending/reviewed/actioned report statuses are deferred per the community-reporting design).
- Report resolution or status transitions (moderators use existing hide/unhide/delete actions; reports remain as durable evidence).
- Moderation dashboard frontend or moderator notification systems.

## Decisions

### 1. Reuse the artwork storage abstraction for avatars

The existing `ArtworkStorage` interface (`upload`, `delete`) and Supabase storage implementation can serve avatars without modification. Avatar storage keys will use a `avatars/{userId}.avif` convention — one key per user, overwritten on replacement.

**Alternative considered:** A separate avatar storage bucket or abstraction. Rejected because the operations are identical and a shared abstraction avoids duplication.

### 2. Store avatar as a storage key, not a URL

The `avatar_url` field on `users` currently stores a nullable text value. This change will repurpose it as a storage key (e.g., `avatars/user-1.avif`) following the same pattern as artwork `storage_key`. The application-controlled endpoint resolves the key to media bytes.

**Alternative considered:** Store the full public URL. Rejected because it couples the profile to a specific storage deployment and breaks cache-layer indirection.

### 3. Avatar media endpoint at `/api/users/{userId}/avatar`

Follows the same pattern as `/api/artworks/{artworkId}/media`. The endpoint resolves the user's avatar storage key and returns the image with cache headers. Returns 404 if no avatar exists.

**Alternative considered:** Serve avatars through the same artworks media endpoint with a different prefix. Rejected because avatars belong to users, not artworks, and the URL hierarchy should reflect that.

### 4. Compensating cleanup on avatar replacement

When a user uploads a new avatar, the old storage object is deleted before or after persisting the new key. If the old cleanup fails, the upload still succeeds (best-effort cleanup, matching artwork publish error handling).

**Alternative considered:** Keep all historical avatars for audit. Rejected because the 1GB storage budget (PRD §11.3) makes accumulation unacceptable for a cosmetic asset.

### 5. Moderation queue as a unified read model across artworks and comments

The queue query aggregates report counts from `content_reports` grouped by target (artwork or comment), joins to the target table for context (title/body, author, hidden state), and returns a single sorted list. This avoids separate artwork-report and comment-report endpoints.

**Alternative considered:** Separate endpoints per target type. Rejected because moderators need a single prioritized view, and the data volume is small enough that a unified query is practical.

### 6. Moderation queue pagination with cursor-based continuation

Follows the same cursor-encoding pattern used by artwork discovery (base64url-encoded JSON with sort key + tie-breaker). The sort key is report count descending, with tie-breaking on target type and ID for determinism.

**Alternative considered:** Offset-based pagination. Rejected because the set of reported items changes as moderators act, making offset unstable.

### 7. Avatar validation reuses artwork media validation with configurable size budget

The AVIF magic-byte check and size-budget enforcement logic from artwork publishing is reusable. The avatar size budget is configured separately (same ~100KB ceiling per PRD §5.2, but as a distinct config constant for independent tuning).

**Alternative considered:** Different format for avatars. Rejected because the PRD specifies AVIF for all persisted media.

## Risks / Trade-offs

- **Single storage key per user means replacement is destructive** → Mitigation: this is intentional per the PRD (users re-draw, not accumulate). CDN cache invalidation may serve stale avatars briefly; cache TTL should be short enough for avatar media.
- **Moderation queue query joins reports to artworks and comments** → Mitigation: report counts are small in early usage. If scale becomes a concern, a denormalized `report_count` column on targets can be added without changing the API.
- **No report status transitions** → Mitigation: moderators use hide/unhide/delete to act. The queue shows items with active reports; once content is deleted, it leaves the queue naturally. This is sufficient for MVP.

## Migration Plan

1. Add avatar upload/replace/delete service and route handler.
2. Add avatar media serving endpoint.
3. Add moderation queue read model and route handler.
4. Add automated tests for avatar pipeline and moderation queue.
5. Run quality gates.

**Rollback:** Remove avatar upload/serve endpoints and moderation queue endpoint. The `avatar_url` field already exists and can be left nullable. No schema migration is expected for this change.

## Open Questions

- Should the avatar media endpoint support conditional requests (ETag/If-None-Match) for cache efficiency, or is a fixed Cache-Control TTL sufficient for MVP?
- Should the moderation queue include a report count history (e.g., reports in the last 24h) for prioritization, or is total count sufficient?
