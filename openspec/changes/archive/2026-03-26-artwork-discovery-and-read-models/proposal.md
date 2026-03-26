## Why

The backend can now authenticate users and persist artworks, but the product still lacks a stable read-side contract for discovering and viewing that content. The PRD's next natural slice is discovery and read models, and it is the right place to define feed queries, artwork detail reads, author projections, cache-friendly media URLs, and deletion semantics before layering on votes, comments, or forks.

## What Changes

- Introduce backend read models for artwork discovery, starting with the `Recent` feed and single-artwork detail reads.
- Define the product-facing artwork projection returned to clients, including author summary data and media access information derived from persisted storage references.
- Establish a cache-aware media delivery contract that exposes application-controlled media URLs while keeping storage keys as internal persistence details.
- Add pagination and ordering behavior for artwork discovery with an extensible sort model prepared for future `Hot` and `Top` modes.
- Define read semantics for missing or deleted artworks so deleted content returns not found rather than introducing a separate visibility-state feature.
- Add automated backend coverage for feed reads, detail reads, pagination, media URL derivation, and not-found behavior.

## Capabilities

### New Capabilities
- `artwork-discovery`: Feed and artwork-detail read models for persisted artworks, including author projections, pagination, ordering, media URL resolution, and deleted-artwork not-found semantics.

### Modified Capabilities
- None.

## Impact

- Affected code: new artwork discovery/read-model services, read repositories/queries, route handlers or server endpoints for feed and detail reads, media URL resolution helpers, and integration tests.
- Affected systems: PostgreSQL query layer, cache-aware media delivery integration, artwork persistence read paths, and public product-facing backend responses for discovery views.
- Dependencies: `identity-and-access` for canonical user context where needed, `artwork-publishing` for persisted artwork records and storage keys, and PRD feed/detail requirements.
- Follow-on work unlocked: votes, comments, realtime engagement, fork lineage reads, moderator visibility rules, and richer feed sorts like `Hot` and `Top` without redesigning the base artwork read contract.
