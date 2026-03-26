## Context

The backend currently covers three contiguous slices of the PRD: identity and access, artwork publishing, and artwork discovery. Users can authenticate, publish artworks, and read feed/detail projections, but there is still no backend domain for the interactions that give those artworks social meaning.

This change sits at an important seam. The PRD wants votes and comments now, but it also wants realtime delivery, `Hot`/`Top` ranking, fork lineage, and moderation soon after. If this slice grows to absorb all of that, it stops being a medium-sized capability and becomes a product-wide social-platform rewrite. The design therefore needs to establish durable engagement behavior and counters now while leaving transport and adjacent domains extensible.

## Goals / Non-Goals

**Goals:**
- Add a backend engagement domain for artwork votes and comments.
- Establish durable persistence and business rules for one-vote-per-user behavior, vote replacement, vote removal, comment creation, and author deletion.
- Derive and expose stable `score` and `commentCount` values so feed and detail reads can reflect engagement without frontend-side recomputation.
- Enrich current artwork read models with engagement summary fields while keeping their existing discovery contract shape recognizable.
- Add server-side abuse protection for high-frequency voting and commenting flows.
- Lock the behavior down with automated tests at the use-case level.

**Non-Goals:**
- Supabase Realtime subscriptions or websocket delivery.
- `Hot` and `Top` feed ranking algorithms.
- Fork lineage, `forkCount`, or parent/child navigation.
- Reporting, auto-hide thresholds, moderator queues, or moderator deletion rules.
- Notifications, sharing, or any UI-specific interaction choreography.

## Decisions

### 1. Model votes and comments as first-class persistence tables under the artwork domain

Votes and comments need their own durable records instead of being inferred or stored as embedded aggregates on artworks. This preserves actor-level state, allows idempotent business rules such as one-vote-per-user-per-artwork, and gives later capabilities like realtime and moderation something concrete to build on.

**Alternative considered:** store only denormalized counters on `artworks`. Rejected because it loses the underlying state needed for vote transitions, comment reads, abuse analysis, and future moderation/reporting work.

### 2. Treat voting as a state transition, not as append-only reactions

The product behavior is not “users emit vote events”; it is “each user has at most one current vote on an artwork.” The write contract should therefore support three stable transitions: create a vote, replace an existing vote value, and remove the current vote. Score derivation then becomes a deterministic consequence of the current persisted vote state.

**Alternative considered:** keep an append-only vote event log and compute the latest effective vote at read time. Rejected because it adds unnecessary complexity for MVP and makes score maintenance and uniqueness guarantees harder.

### 3. Keep engagement summaries on artwork read models, but keep full comment reads in the community-interactions capability

Feed and detail surfaces need stable summary metrics, so `score` and `commentCount` belong on artwork feed/detail projections. The full chronological comment list, however, is its own engagement read concern and should remain in the new capability rather than bloating the existing artwork discovery spec into a general social surface.

**Alternative considered:** move all comment reads into artwork discovery/detail. Rejected because it would overextend the discovery capability and blur the boundary between artwork projection reads and interaction-domain reads.

### 4. Maintain derived counters in the backend domain rather than asking clients to aggregate

The PRD expects feed cards and artwork detail views to show stable engagement values. Those values should come from the backend as canonical domain state, not from client-side aggregation over votes/comments. Whether the implementation uses transactional recalculation, incremental updates, or trigger-backed maintenance can remain an implementation detail, but the contract should guarantee backend-owned consistency.

**Alternative considered:** return raw vote/comment rows and let the UI derive totals. Rejected because it leaks domain work into the frontend and creates inconsistent representations across surfaces.

### 5. Reuse the existing durable rate-limit posture for engagement flows

Identity and artwork publishing already established the pattern that abuse protection should survive restarts and multiple app instances. Voting and commenting should follow that same rule with dedicated durable server-side limit state keyed by authenticated actor, rather than ephemeral in-memory throttles.

**Alternative considered:** use process-local throttling because interactions are lightweight. Rejected because it breaks the durability standard already established in the codebase and becomes ineffective in multi-instance deployments.

### 6. Keep deletion semantics simple before moderation exists

Comment deletion in this slice should be author-controlled removal from active content, not a soft-hidden moderation state. This keeps the behavior aligned with the current pre-moderation system and avoids inventing visibility states that later moderation work will likely refine.

**Alternative considered:** introduce `is_hidden` and moderation-ready comment states now. Rejected because moderation is the next-next domain and would significantly widen this slice.

## Risks / Trade-offs

- Counter consistency can drift if engagement state and artwork summaries are updated separately -> Mitigation: require backend-owned consistency semantics and validate them with integration tests covering create/update/delete transitions.
- Enriching artwork read models now creates a dependency between discovery and engagement timing -> Mitigation: keep the enrichment limited to summary fields only, so the discovery contract evolves without absorbing full interaction workflows.
- Vote/comment rate limits may need tuning once real usage appears -> Mitigation: make thresholds configurable and specify the behavior, not hardcoded magic values, in the contract.
- Comment deletion semantics may need to change once moderation and audit trails arrive -> Mitigation: scope this change to active-content behavior and defer hidden/tombstone states to the moderation capability.

## Migration Plan

1. Add engagement persistence structures for votes, comments, and any durable rate-limit state required by the new rules.
2. Implement vote and comment application services with authenticated ownership/authorization checks.
3. Extend artwork read-model projections to expose `score` and `commentCount`.
4. Add routes or server endpoints for vote transitions, comment creation/listing/deletion, and enriched artwork reads.
5. Add automated coverage for state transitions, counter consistency, read enrichment, and abuse-protection behavior.

**Rollback:**
- Remove the engagement endpoints/services and revert the schema additions and projection enrichment. Because this slice is additive to the current backend, rollback is manageable as long as dependent frontend work is not yet coupled to the new fields.

## Open Questions

- Should vote/comment rate-limit windows be specified in the spec with PRD-level defaults now, or left as configurable implementation settings with only behavioral guarantees in the spec?
- Should artwork detail eventually include a lightweight “viewer vote” summary for authenticated users, or should that wait until the frontend actually needs personalized read state?
