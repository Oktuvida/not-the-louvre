## Context

The repository now has a completed `identity-and-access` capability and corresponding backend foundations: authenticated sessions, canonical current-user resolution, product-owned user records, recovery-key flows, and durable auth abuse protection. What is still missing is the first true content-domain backend slice. Authenticated users cannot yet persist artworks, no artwork tables exist in the application schema, and there is no server-side lifecycle for publishing, updating, or deleting media-backed content.

This change is more than a simple CRUD addition because the PRD now treats storage footprint and egress as first-class constraints. Artwork publishing must respect a strict media contract: persisted images are AVIF, target roughly 100KB maximum size, and should be delivered through application-controlled URLs that fit behind a cache layer instead of pushing clients directly to the bucket. That means the backend slice needs to define both domain behavior and media/storage policy at the same time.

## Goals / Non-Goals

**Goals:**
- Establish the persistent artwork domain as the next backend slice after identity and access.
- Define an authenticated publish flow that validates the media contract, writes to storage, and persists the artwork record.
- Introduce ownership-safe artwork lifecycle operations for title edits and deletions.
- Keep media delivery compatible with the PRD's cache-first and low-egress posture.
- Add automated backend coverage for publish, edit, delete, media validation, and failure handling.

**Non-Goals:**
- Feed read models, sorting, pagination, or artwork discovery queries.
- Fork lineage behavior, parent/child navigation, or deleted-parent attribution semantics.
- Votes, comments, reports, or moderator workflows.
- A full image transformation pipeline or server-side re-encoding service beyond enforcing MVP media invariants.
- Public API versioning or a separate backend service boundary outside the SvelteKit app.

## Decisions

### 1. Introduce an application-owned `artworks` table now, but keep it intentionally narrow

This change should add the first real `artworks` persistence model to the application schema. The initial table should focus on fields required for publishing and ownership: artwork id, author id, title, storage key/path, media metadata needed for validation, visibility/deletion state if required, and timestamps.

Fields that mainly serve later slices, such as score, comment count, fork count, or fork lineage-specific behavior, should not be fully activated in this change unless they are structurally cheap and clearly beneficial. The goal is to create a durable domain foundation without prematurely absorbing the read-model and social concerns that belong to later specs.

**Alternative considered:** create the full final PRD `artworks` shape immediately, including counters and parent linkage. Rejected because it couples this slice to later feed, social, and lineage behavior, making the first content-domain spec too broad.

### 2. Treat media validation as a server-side policy even if client-side export does most of the work

The frontend canvas/export flow will likely be responsible for producing AVIF output, but the backend must still enforce the invariants that matter operationally. Publish requests should be rejected unless they satisfy the MVP media contract: AVIF format, roughly 100KB maximum size, and acceptable dimensions/metadata as defined by implementation.

This avoids a fragile design where the client is assumed to behave correctly and keeps the storage budget enforceable even if a buggy or malicious client bypasses normal UI behavior.

**Alternative considered:** trust the client to export compliant files and only store whatever arrives. Rejected because it makes the 1GB storage budget and 5GB egress budget unenforceable in practice.

### 3. Make the server the orchestration boundary for publish, not direct client-to-bucket persistence

The backend should own the publish workflow boundary: validate the request, confirm authenticated ownership, write the media to storage using controlled object keys, and create the database record. The client may still upload bytes through an application endpoint or a controlled handoff, but direct bucket hotlinking as the primary product contract is the wrong abstraction for this stage.

This gives the backend one place to enforce naming, ownership, size limits, deletion policy, and future moderation hooks.

**Alternative considered:** let the client upload directly to storage and only call the backend afterward to register metadata. Rejected for this slice because it increases orphaned-object risk, weakens policy enforcement, and works against the application's desire for controlled delivery semantics.

### 4. Store durable media references as storage keys and expose cache-friendly application-controlled URLs

The persisted artwork record should store a stable storage key/path rather than a raw public bucket URL. Read-side consumers can later derive application-controlled media URLs or signed/proxied access patterns from that key.

This keeps the persistence model independent from whatever cache layer or delivery strategy is chosen in deployment while still aligning with the PRD's requirement that users do not read directly from the bucket in the normal app path.

**Alternative considered:** store fully resolved bucket URLs in the `artworks` table. Rejected because URL shape is deployment-specific, couples the domain to infra details, and makes future cache-layer changes painful.

### 5. Handle publish as a two-phase workflow with explicit compensation for partial failure

A publish request touches two systems: object storage and PostgreSQL. That cannot be made perfectly atomic without much heavier infrastructure, so the design should explicitly embrace a compensating workflow:

1. validate request and auth context
2. generate the storage key
3. write media to storage
4. create the artwork row
5. if database persistence fails after storage succeeds, attempt cleanup of the just-written object and surface a safe error

This keeps the logic understandable and addresses the main operational risk: orphaned media objects consuming storage budget.

**Alternative considered:** persist the DB row first, then upload the object later asynchronously. Rejected because it complicates publish semantics for the UI and introduces incomplete artwork records too early.

### 6. Put title edits and artwork deletions in the same slice because they share the ownership boundary

If this change only introduced publish, the next spec would still need to reopen the same ownership and storage-lifecycle concerns to handle title updates and deletions. It is cleaner to keep the first artwork slice responsible for the full author-owned lifecycle: create, rename, and delete.

Deletion semantics should focus on removing the author's artwork in a way that also cleans up or tombstones the storage object safely. Fork-preservation semantics are explicitly deferred until lineage exists as a real capability.

**Alternative considered:** leave edits and deletes for later. Rejected because it produces an awkward half-domain where content can be created but not managed by its owner.

### 7. Add publish-specific abuse protection separate from auth abuse protection

Publishing consumes the scarcest resources in the current system: storage capacity and egress potential. The backend should introduce a narrow publish rate limit aligned with the PRD's abuse posture so one account cannot rapidly exhaust the storage budget.

This should remain specific to publishing rather than becoming a generic, platform-wide rate-limiting framework in this change.

**Alternative considered:** rely on auth-level rate limits or postpone publish limits until later. Rejected because storage abuse is a direct risk of this capability, not a theoretical future concern.

## Risks / Trade-offs

- **Storage writes and DB writes are not truly atomic** -> Mitigation: use an explicit compensation path that deletes newly uploaded media if record creation fails.
- **Backend-side media validation may be weaker than full image processing** -> Mitigation: enforce the invariant set that matters most now (format, size, basic metadata) and leave richer transformations for a later spec if needed.
- **Application-controlled delivery adds indirection before read models exist** -> Mitigation: store stable keys now and keep delivery concerns abstract enough that later read slices can choose proxy, signed URL, or CDN-backed patterns.
- **Deleting artworks may intersect with future fork behavior** -> Mitigation: scope deletion semantics to the pre-lineage phase and explicitly revisit them when fork support is introduced.
- **The PRD's canonical data model is broader than this slice** -> Mitigation: add only the narrow fields required for publishing and ownership, then extend safely in later specs.

## Migration Plan

1. Extend the application schema with the first `artworks` table and any narrowly scoped publish-rate-limit persistence needed for this change.
2. Generate and apply the corresponding Drizzle migration set.
3. Introduce server-side validation and service boundaries for publish, title update, and delete flows.
4. Add storage integration and controlled object key generation aligned with authenticated ownership.
5. Add automated tests for publish success, invalid media rejection, ownership enforcement, title updates, delete behavior, and partial-failure cleanup where practical.
6. Land this slice before feed, detail-read, or social-interaction specs so later work can depend on a stable artwork lifecycle.

**Rollback:**
- Before real user content exists, rollback is straightforward: revert the change and migration set.
- After real media is stored, rollback becomes operational rather than purely schema-based because stored objects and DB rows may both need cleanup; in practice this slice should be treated as foundational once adopted.

## Open Questions

- Should avatar persistence stay separate from this spec, or should the same storage/media contract be reused immediately in a closely following avatar-focused slice?
- For MVP delivery, should media reads later go through a lightweight application proxy, signed URLs behind a cache, or another cache-aware pattern?
- Should artwork deletion physically remove rows immediately, or should the first implementation prefer a soft-delete/tombstone model even before moderation and lineage arrive?
