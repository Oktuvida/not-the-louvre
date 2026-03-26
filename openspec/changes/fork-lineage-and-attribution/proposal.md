## Why

The backend now supports identity, artwork publishing, discovery reads, and community interactions, but the product still lacks the lineage mechanics that make forking a first-class creative loop instead of a UI illusion. The PRD places forking immediately after feed and social interaction, and this is the right moment to define parent/child relationships, attribution, and fork-aware reads before moving into larger domains like moderation or realtime delivery.

## What Changes

- Introduce backend lineage behavior for creating a new artwork as a fork of an existing parent artwork.
- Persist parent/child relationships for artworks and define the invariants around valid fork targets.
- Add attribution semantics so feed and detail reads can expose whether an artwork is original or forked, and who it was forked from.
- Extend artwork detail reads with immediate lineage navigation: parent artwork summary and direct child forks.
- Add derived `forkCount` semantics so artwork reads expose stable fork totals backed by the backend domain.
- Define deleted-parent behavior so forks remain valid active content even when the original artwork is no longer available.
- Add automated backend coverage for fork creation rules, lineage reads, attribution, derived fork counters, and deleted-parent semantics.

## Capabilities

### New Capabilities
- `fork-lineage`: Artwork parent/child relationships, fork creation rules, attribution, derived fork counters, and immediate lineage reads for the application backend.

### Modified Capabilities
- `artwork-publishing`: Publishing requirements expand to support creating a new artwork as a fork of an existing artwork while preserving the current media and ownership rules.

## Impact

- Affected code: `apps/web/src/lib/server/db/schema.ts`, artwork mutation services, artwork read-model services, route handlers for fork-capable publish flows and lineage reads, and backend integration tests.
- Affected systems: PostgreSQL/Drizzle schema and migrations, artwork persistence rules, read-model projection contracts for feed/detail views, and deletion semantics for lineage-aware content.
- Dependencies: `identity-and-access` for canonical current-user context, `artwork-publishing` for persisted artwork ownership and media lifecycle, `artwork-discovery` for read projections, and `community-interactions` for coexistence with existing artwork counters.
- Follow-on work unlocked: richer fork UI, fork-aware feed cards, lineage carousels, creator notifications, moderation rules for fork trees, and future replay/remix features built on canonical parent/child relationships.
