## Context

The backend now has two foundational capabilities in place: `identity-and-access` establishes canonical authenticated users and `artwork-publishing` establishes the write-side lifecycle for persisted artworks. Users can create, rename, and delete artworks, and the persistence model stores a stable `storageKey` instead of a public media URL. What is still missing is the read-side contract the product actually needs for feed browsing and artwork detail pages.

The PRD's next roadmap step after artwork domain work is discovery and read models. This change should define how artworks are queried, projected, paginated, and exposed to clients without yet absorbing the additional complexity of votes, comments, realtime updates, moderation visibility states, or fork lineage. It also needs to honor the storage/egress decisions already made: clients should consume application-controlled media URLs suitable for a cache layer, while storage keys remain internal persistence details.

## Goals / Non-Goals

**Goals:**
- Establish the first backend read models for persisted artworks.
- Support a `Recent` discovery feed and single-artwork detail reads.
- Define a stable product-facing artwork projection that includes author summary data and application-controlled media access information.
- Introduce pagination and an extensible sort model that can grow into `Hot` and `Top` later without redesigning the base contract.
- Keep deleted artworks simple at the backend level by returning not found instead of inventing a separate visibility feature.
- Add automated coverage for feed and detail reads, pagination, media URL derivation, and deleted-artwork semantics.

**Non-Goals:**
- Vote creation, vote counts, comment creation, comment reads, or realtime subscriptions.
- Fork parent/child navigation or lineage-specific detail projections.
- Moderator-specific visibility rules, hidden states, or report-driven filtering.
- Full search, recommendation, or algorithmic ranking.
- UI copy behavior for humorous 404s; that remains a presentation concern on top of backend not-found semantics.

## Decisions

### 1. Build a dedicated artwork read-model layer instead of reusing write-side service shapes

The existing artwork service is oriented around mutation workflows: publish, rename, and delete. Read-side needs are different. Feed cards and detail pages need shaped projections, author summaries, derived media URLs, and pagination metadata. This change should introduce dedicated read-model services and queries rather than leaking raw database rows or reusing mutation-oriented service outputs.

**Alternative considered:** return raw `artworks` rows from repository methods directly to the app. Rejected because the product-facing read contract needs derived fields and should remain decoupled from the narrow persistence model.

### 2. Expose `mediaUrl` in read models while keeping `storageKey` internal

The backend persistence model should continue storing stable `storageKey` values, but client-facing feed and detail reads should expose an application-controlled `mediaUrl` derived from that key. This best matches the PRD's cache-aware delivery intent: the database remains infra-agnostic, while the read contract gives the frontend a ready-to-use reference that can sit behind application routing, proxying, or future CDN behavior.

**Alternative considered:** expose `storageKey` directly to the client and let the frontend derive URLs. Rejected because it leaks internal persistence details and pushes delivery policy into the UI.

### 3. Start with `Recent` as the only implemented sort, but make sort selection extensible

The PRD defines `Recent`, `Hot`, and `Top`, but only `Recent` is well-supported by the current backend domain. `Hot` and `Top` depend on engagement data that does not exist yet. This change should therefore implement `Recent` behavior while shaping the request/response contract so later sort modes can be added without replacing the endpoint family or response structure.

**Alternative considered:** implement all PRD feed sorts immediately. Rejected because it would force this change to absorb voting and ranking concerns before those capabilities exist.

### 4. Use a dedicated feed card projection and a richer detail projection

The feed and detail views should not return identical payloads by default. Feed cards need a compact summary oriented around listing: id, title, mediaUrl, createdAt, and a small author projection. Detail reads need a fuller projection that can support the single-artwork page without yet adding forks, votes, or comments.

This separation keeps the data contract intentional and avoids overfetching the feed while still letting detail evolve independently later.

**Alternative considered:** define one universal artwork DTO for all reads. Rejected because it encourages accidental coupling between list and detail surfaces.

### 5. Deleted artworks should resolve as not found at the backend boundary

The product does not yet have a visibility-management feature beyond deletion. This change should therefore treat deleted artworks as absent content in read paths. Feed queries should not return deleted artworks, and detail reads for deleted or missing artworks should return not found.

This keeps the backend semantics crisp and leaves room for the frontend to render humorous 404 copy without turning product personality into a domain-state variant.

**Alternative considered:** introduce tombstone read records or a dedicated deleted-content payload now. Rejected because that anticipates moderation and lineage concerns that are not yet in scope.

### 6. Pagination should be stable and forward-compatible with infinite scroll

The PRD expects infinite scroll in the feed. This means the backend should expose a pagination model that is stable under incremental loading and suitable for future growth. Cursor-based pagination keyed primarily by `createdAt` plus a tiebreaker is a good fit for `Recent`, although the precise transport shape can remain implementation-specific.

**Alternative considered:** simple page-number pagination. Rejected because infinite scroll tends to behave better with cursors and because later sorts will benefit from more stable continuation semantics.

### 7. Author projections should come from the canonical product user record

Artwork reads should present author data from the application-owned user profile, not raw Better Auth internals. The minimum projection should include nickname and avatar reference information needed by the feed and detail views.

This keeps read models aligned with the existing identity boundary decisions and avoids leaking auth-library-specific user shapes into product reads.

**Alternative considered:** join and expose raw auth user fields for convenience. Rejected because the app already established the product `users` table as the canonical identity record.

## Risks / Trade-offs

- **Adding read models before engagement data exists may create temporary placeholders** -> Mitigation: keep the first projection focused on what is currently real (`Recent`, author summary, media URL, timestamps) and defer score-driven concerns.
- **Media URL shape may evolve as cache infrastructure becomes concrete** -> Mitigation: treat `mediaUrl` as an application-controlled contract derived from internal `storageKey`, not as a direct storage URL.
- **Cursor pagination adds a bit more implementation complexity than page numbers** -> Mitigation: accept the extra structure now to avoid later contract churn for infinite scroll.
- **Deleted-artwork 404 semantics may need revisiting once forks or moderation exist** -> Mitigation: explicitly scope this behavior to the current pre-lineage, pre-moderation phase.

## Migration Plan

1. Add the read-side query and projection layer for artwork feed and detail use cases.
2. Introduce media URL derivation helpers that map persisted storage keys into application-controlled read URLs.
3. Add feed and detail route handlers or server endpoints using the new read models.
4. Add automated tests for `Recent` ordering, pagination, detail retrieval, deleted-artwork 404 behavior, and projection shape.
5. Land this change before votes/comments/fork reads so later capabilities can extend an already stable artwork read contract.

**Rollback:**
- This change is primarily additive on the read side, so rollback is low-risk: remove the read endpoints/services and return to the current state where discovery views are not yet available.

## Open Questions

- Should the initial read model include placeholder numeric fields such as score/commentCount/forkCount for UI consistency, or should those appear only when their backing domains exist?
- Should media URL derivation be expressed as a dedicated backend media route from the start, or as a helper that produces the eventual route shape while the transport remains private to the server layer?
