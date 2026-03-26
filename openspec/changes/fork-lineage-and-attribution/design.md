## Context

The backend now covers four contiguous slices of the PRD: identity and access, artwork publishing, artwork discovery, and community interactions. Users can authenticate, publish artworks, browse feed/detail reads, and interact through votes and comments, but they still cannot create or navigate forks as a canonical backend capability. That leaves one of the product's most distinctive loops only implied by the PRD, not enforced by backend rules.

This change sits at a healthy seam. The PRD wants forks to be a visible lineage chain with attribution, parent/child navigation, and deleted-parent resilience. At the same time, it does not require deep tree exploration, replay, notifications, moderation-aware lineage policies, or realtime fork events yet. The design should therefore establish durable lineage rules and fork-aware reads now without absorbing adjacent domains that would make the slice too large.

## Goals / Non-Goals

**Goals:**
- Add backend support for publishing a new artwork as a fork of an existing artwork.
- Persist canonical parent/child lineage through `parent_id` and backend-owned fork invariants.
- Expose fork attribution in product-facing artwork reads.
- Extend artwork detail reads with immediate lineage navigation: one parent summary and direct child forks.
- Maintain a stable backend-owned `forkCount` so feed/detail reads can expose lineage summary information without client-side aggregation.
- Define how forked artworks behave when the original parent is deleted.
- Lock the behavior down with automated tests at the use-case level.

**Non-Goals:**
- Realtime fork notifications or websocket delivery.
- Arbitrary-depth lineage tree traversal or graph visualization.
- Fork replay, diffing, or remix metadata beyond direct parent reference.
- Feed ranking changes such as `Hot` and `Top`.
- Moderation-driven visibility states for fork trees.
- Frontend canvas UX for loading the parent as a locked background layer; this change only defines backend semantics and contracts needed for that UX.

## Decisions

### 1. Model fork lineage as a nullable self-reference on artworks plus derived child summaries

Forking is fundamentally a relationship between artworks, not a separate aggregate root. The canonical persistence model should therefore remain centered on `artworks`, with a nullable `parent_id` referencing another artwork. Child navigation and fork counts can then be derived from that relationship without inventing an extra join entity for MVP.

**Alternative considered:** introduce a dedicated `artwork_forks` table separate from `artworks`. Rejected because it duplicates relationship state that the PRD already describes as a property of the artwork itself and would complicate reads that only need immediate parent/child navigation.

### 2. Treat fork creation as a specialized artwork publish flow, not a second publishing domain

Forks are still artworks: they have an author, media, title, storage reference, and ownership lifecycle. The main new behavior is that publish can optionally declare an existing parent artwork. This change should therefore extend the current publishing capability rather than creating an entirely separate write pipeline.

**Alternative considered:** add a separate fork-creation service and endpoint family disconnected from publish semantics. Rejected because it would duplicate validation, media handling, and storage logic already established in `artwork-publishing`.

### 3. Only immediate lineage navigation belongs in this slice

The PRD requires viewing an artwork's immediate parent and its direct forks. That is enough to support attribution and jump navigation without pulling in deep-tree traversal, recursive queries, or lineage exploration UX. Detail reads should therefore expose at most one parent summary and a list of direct child fork summaries.

**Alternative considered:** support full ancestor chains and descendant trees now. Rejected because it expands the backend contract and query complexity beyond the MVP requirement for this phase.

### 4. Fork attribution should be resilient to deleted parents

Forks remain valid active artworks even when the original artwork is deleted. The lineage contract should therefore preserve enough fork metadata to say “this is a fork” and expose either a live parent summary or a deleted-parent attribution state. Reads should not silently convert a fork into an original artwork just because its parent disappeared.

**Alternative considered:** cascade delete child forks when a parent artwork is deleted. Rejected because the PRD explicitly says forks remain intact and only attribution degrades to deleted-parent messaging.

### 5. Maintain `forkCount` as a backend-owned derived field on artworks

Feed cards and detail views need a stable fork total, and later product features will likely depend on that count. The backend should therefore own `forkCount` as canonical derived state on artworks, similar in spirit to `score` and `commentCount`, instead of requiring clients to count children ad hoc.

**Alternative considered:** compute child counts on every read. Rejected because it leaks aggregation concerns into each query surface and makes feed/detail projections less stable as usage grows.

### 6. Forking should require an existing active parent artwork at creation time

To create a fork, the chosen parent must exist as active content when the fork is created. This keeps publish semantics deterministic and avoids special cases such as forking already-deleted or missing content. After creation, later parent deletion does not invalidate the child fork.

**Alternative considered:** allow forks from deleted/tombstoned parents if an id is known. Rejected because the product currently has no need for that complexity and it weakens the meaning of a valid parent reference.

## Risks / Trade-offs

- **Lineage-aware reads add another layer of projection complexity** -> Mitigation: keep the contract to immediate parent and direct children only, with compact summaries.
- **Derived `forkCount` can drift if child creation/deletion and parent summary updates are not coordinated** -> Mitigation: require backend-owned consistency semantics and validate them through mutation-focused tests.
- **Deleted-parent semantics may intersect with moderation later** -> Mitigation: scope this slice to normal deletion behavior only and defer hidden/tombstone moderation states.
- **Extending publish for forks could tempt the change to absorb canvas UX concerns** -> Mitigation: keep the spec focused on backend inputs, persistence rules, and read contracts, not frontend scene behavior.

## Migration Plan

1. Extend the artwork persistence model with lineage support and any derived `forkCount` state needed by the contract.
2. Extend artwork publish flows so a new artwork can optionally reference a valid parent artwork.
3. Add lineage-aware read-model projections for feed/detail surfaces, including attribution, parent summary, and direct child fork summaries.
4. Add automated tests for fork creation rules, derived fork counts, deleted-parent behavior, and lineage navigation reads.
5. Land this change before feed ranking or moderation so those later slices build on stable lineage semantics.

**Rollback:**
- Revert the lineage schema additions and remove fork-aware publish/read behavior. Because this slice is additive to the current artwork domain, rollback remains manageable if dependent frontend work has not yet coupled to fork-specific fields.

## Open Questions

- Should feed-card projections expose `forkCount` immediately in this slice, or should the count first appear only in detail reads and expand to cards once the frontend is ready?
- Should lineage read summaries include only identity/title/author data, or also lightweight engagement metrics inherited from the existing enriched artwork projections?
