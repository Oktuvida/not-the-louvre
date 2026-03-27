## Why

The backend now supports publishing, discovery, engagement, and fork lineage, but the feed still behaves like a single chronological list. The PRD defines `Hot` and `Top` as core product-facing feed modes, and this is the right moment to turn the current read model into a richer discovery surface before stepping into the larger moderation/governance slice.

## What Changes

- Introduce backend ranking behavior for `Hot` and `Top` artwork feed modes on top of the existing `Recent` feed.
- Define the ranking contract for `Hot`, including recency-weighted score ordering based on persisted engagement state.
- Define the ranking contract for `Top`, including explicit time windows such as `Today`, `This Week`, and `All Time`.
- Extend artwork discovery read models and request validation to support ranked feed selection and time-window selection where applicable.
- Define stable pagination and deterministic tie-breaking semantics for ranked feeds so infinite scrolling remains consistent.
- Add automated backend coverage for ranking order, window filtering, pagination continuity, and invalid sort/window handling.

## Capabilities

### New Capabilities
- `feed-ranking`: Ranked artwork discovery for `Hot` and `Top`, including ranking semantics, time-windowed top feeds, deterministic pagination, and validation of ranking-oriented feed queries.

### Modified Capabilities
- `artwork-discovery`: Discovery requirements expand from `Recent`-only behavior to a multi-sort feed contract that supports `Recent`, `Hot`, and `Top` while preserving stable product-facing read projections.

## Impact

- Affected code: artwork discovery read repositories/services, feed query validation, ranking helpers, route handlers for artwork discovery, and backend integration tests.
- Affected systems: PostgreSQL query layer, ranked read-model semantics, cursor/pagination logic, and feed response contracts consumed by the application.
- Dependencies: `artwork-discovery` for the existing feed contract, `community-interactions` for stable `score` and `commentCount`, and `fork-lineage` for coexistence with existing `forkCount` feed summaries.
- Follow-on work unlocked: realtime feed refresh policies, moderation-aware ranking exclusions, creator notifications tied to ranking movement, and later recommendation/search work built on a stable multi-sort discovery foundation.
