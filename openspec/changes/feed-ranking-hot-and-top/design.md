## Context

The backend now covers the core artwork loop described in the PRD: users can authenticate, publish artworks, browse feed/detail reads, react with votes and comments, and create forks with lineage-aware reads. What is still missing is ranking. The feed currently has the shape of a discovery surface, but not yet the curation behavior the product promises through `Hot` and `Top` tabs.

This change should stay disciplined. The PRD's feed section introduces three explicit listing modes, but only `Recent` exists today. The natural next step is to define ranking semantics and ranked-read behavior using the engagement and lineage signals that now exist, without absorbing adjacent concerns like realtime feed resorting, moderation-aware exclusion policies, or personalized recommendation logic.

## Goals / Non-Goals

**Goals:**
- Add backend support for `Hot` and `Top` discovery modes in addition to the existing `Recent` feed.
- Define a stable ranking contract for `Hot` based on persisted score plus recency weighting.
- Define `Top` feed behavior across explicit time windows such as `Today`, `This Week`, and `All Time`.
- Extend feed query validation and pagination semantics so ranked feeds remain deterministic and infinite-scroll friendly.
- Keep the product-facing artwork feed-card projection stable while allowing richer ranking metadata internally.
- Add automated coverage for ranking order, window filtering, tie-breaking, invalid query handling, and pagination continuity.

**Non-Goals:**
- Realtime feed reordering or push updates while browsing.
- Personalized ranking, recommendation, or search.
- Moderator/report-driven filtering and hidden-content ranking rules.
- Notification systems for ranking changes.
- Redesigning artwork feed cards or adding UI-specific ranking explanations.

## Decisions

### 1. Treat ranking as an extension of artwork discovery, not as a separate social domain

The feed already exists as a product-facing discovery contract. `Hot` and `Top` are not new aggregates; they are additional query behaviors over the same artwork discovery surface. This change should therefore extend the discovery layer rather than inventing a parallel ranking API family detached from feed reads.

**Alternative considered:** create a separate ranking-only capability disconnected from artwork discovery. Rejected because the product still consumes the same feed-card projection and pagination model; splitting the surface would create unnecessary contract duplication.

### 2. Keep ranking formulas backend-owned and explicit

The PRD gives a concrete starting point for `Hot`: score weighted by recency with a configurable gravity factor. The backend should own this ranking formula so every client sees the same ordering and the product can evolve the formula centrally later. `Top` should remain simpler: score-descending within an explicit time window.

**Alternative considered:** let clients sort a `Recent` feed locally using returned counters. Rejected because it would make ranking inconsistent, pagination unstable, and formula evolution much harder.

### 3. Use explicit sort and time-window parameters with strict validation

`Recent`, `Hot`, and `Top` should be explicit feed modes in the backend contract. `Top` additionally needs a validated time-window parameter because “today”, “this week”, and “all time” are not interchangeable. Requests should reject unsupported sort or window values rather than silently falling back.

**Alternative considered:** accept free-form strings and default invalid input to `Recent`. Rejected because ranking behavior is product-significant and silent fallback makes debugging and frontend integration harder.

### 4. Preserve deterministic pagination through stable tie-breakers

Ranked feeds increase the chance of ties and reordered results. To keep infinite scroll sane, the backend should use stable cursor semantics with deterministic tie-breakers beyond the primary rank metric. That likely means each ranking mode needs a cursor shape keyed by its rank inputs plus a stable artwork identity tiebreaker.

**Alternative considered:** offset pagination for ranked feeds. Rejected because ranking surfaces are more sensitive to drift and duplicate/skip behavior under incremental loading.

### 5. Scope `Top` windows to the PRD's explicit product slices

The PRD already names `Today`, `This Week`, and `All Time`. This change should implement those windows directly rather than inventing a generic arbitrary-range ranking API. That keeps the slice product-grounded and avoids prematurely opening a wider analytics/query-design problem.

**Alternative considered:** support arbitrary date-range filters immediately. Rejected because it expands the API surface without a corresponding product need.

### 6. Reuse existing feed projections rather than introducing ranking-specific DTOs

The backend already has a stable feed-card projection. Ranked feeds should continue returning that same projection shape so the frontend can switch sorting modes without consuming a different payload family. Ranking changes ordering, not the identity of the resource being returned.

**Alternative considered:** add separate `HotCard` or `TopCard` response shapes. Rejected because ranking is a read-order concern, not a new feed-item resource type.

## Risks / Trade-offs

- **Ranking formulas may need tuning after real usage appears** -> Mitigation: encode the behavioral contract in specs while keeping implementation constants configurable.
- **Stable ranked pagination is trickier than chronological pagination** -> Mitigation: define deterministic cursor semantics and test duplicate/skip resistance explicitly.
- **`Top` window semantics may later intersect with moderation or hidden-content policies** -> Mitigation: scope this slice to the current active-content rules and defer moderation-aware ranking exclusions.
- **Ranking increases query complexity on the discovery path** -> Mitigation: keep the first version bounded to three explicit modes and validate performance/ordering through focused read-model tests.

## Migration Plan

1. Extend artwork discovery validation and route contracts to accept `Recent`, `Hot`, and `Top` sorts, plus `Top` windows.
2. Add ranked query behavior in the discovery read layer for `Hot` and `Top`.
3. Introduce deterministic cursor semantics and tie-breakers for ranked feeds.
4. Add automated tests for order correctness, invalid sort/window rejection, and ranked pagination continuity.
5. Land ranking before moderation so future visibility rules can build on an already-defined multi-sort feed contract.

**Rollback:**
- Remove ranked sort handling and return the feed surface to `Recent`-only behavior. Because this slice extends existing read paths rather than changing the write-side domain, rollback remains low-risk if clients have not yet hard-depended on the new sort modes.

## Open Questions

- Should `Hot` ranking use only `score` and recency, or should `forkCount` be allowed to influence the formula later without changing the public contract?
- Should the backend expose any lightweight metadata describing the active sort/window in the response, or is request-driven context sufficient for MVP?
