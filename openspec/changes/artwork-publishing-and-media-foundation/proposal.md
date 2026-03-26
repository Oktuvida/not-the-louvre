## Why

The backend now has a solid identity and access foundation, but authenticated users still cannot persist artworks through a product-grade publishing flow. The PRD makes artwork publishing the next core backend slice, and recent storage constraints make it important to define media rules, ownership, and storage integration before feed, votes, comments, or forks build on top of them.

## What Changes

- Introduce the backend artwork domain foundation for persisted artworks owned by authenticated users.
- Define the server-side publish flow for artwork creation, including title handling, media validation, storage persistence, and database record creation.
- Establish media invariants for persisted artwork images: AVIF format, roughly 100KB maximum size, and application-controlled delivery compatible with a cache layer.
- Add authenticated ownership rules for editing artwork titles and deleting artworks.
- Add storage-abuse protections for publishing, including publish rate limiting and safe handling of partial failures between storage and database writes.
- Add automated backend coverage for artwork publishing, title edits, deletion, ownership enforcement, and media/storage constraints.

## Capabilities

### New Capabilities
- `artwork-publishing`: Authenticated artwork creation, persisted artwork metadata, media validation rules, storage-backed publishing lifecycle, title editing, deletion, and ownership protections.

### Modified Capabilities
- None.

## Impact

- Affected code: `apps/web/src/lib/server/db/schema.ts`, new artwork-focused server services and validation modules, storage integration code, authenticated route handlers/actions for publish/edit/delete flows, and backend integration tests.
- Affected systems: PostgreSQL/Drizzle schema and migrations, Supabase Storage usage, cache-aware media delivery strategy, request-local auth/authorization checks, and environment configuration for storage access.
- Dependencies: `identity-and-access` as the existing authentication foundation; Supabase Storage as the underlying object store; PRD media constraints requiring AVIF, ~100KB limits, and cached delivery.
- Follow-on work unlocked: feed read models, artwork detail reads, forks, votes, comments, moderation workflows, and any later capability that depends on persisted artwork ownership and media references.
