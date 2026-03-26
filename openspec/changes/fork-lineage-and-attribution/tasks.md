## 1. Lineage persistence foundations

- [x] 1.1 Add schema and migration support for `parent_id`, `forkCount`, and any lineage indexes needed for immediate parent/child reads.
- [x] 1.2 Extend artwork repository types and persistence access for fork-aware creation, parent lookup, child lookup, and derived fork-count maintenance.
- [x] 1.3 Add failing schema/repository tests that describe parent-child persistence, deleted-parent resilience, and fork-count consistency.

## 2. Fork-capable artwork publish flows

- [x] 2.1 Add failing service tests for fork creation, invalid parent rejection, authenticated ownership, and coexistence with the current publish flow.
- [x] 2.2 Extend artwork publish behavior and server boundaries so a new artwork can optionally be created as a fork of an existing active artwork.
- [x] 2.3 Ensure parent `forkCount` stays consistent after child creation and child deletion and validate the behavior with automated tests.

## 3. Lineage-aware read models

- [x] 3.1 Add failing read-model tests for fork attribution, parent summary reads, direct child fork reads, and deleted-parent attribution behavior.
- [x] 3.2 Extend artwork detail projections to expose parent attribution state and direct child fork navigation summaries.
- [x] 3.3 Add or update feed/detail route tests to verify lineage-enriched reads remain compatible with existing artwork read semantics.

## 4. Quality validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` and resolve any failures.
