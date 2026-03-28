## 1. Report lifecycle foundations

- [x] 1.1 Add failing schema, repository, or integration tests for report lifecycle state, reviewer attribution, and duplicate-active-report rejection per reporter and target.
- [x] 1.2 Extend the report schema and migrations with lifecycle fields, reviewer attribution, and database constraints or indexes for active-report uniqueness.
- [x] 1.3 Backfill existing reports into the initial active lifecycle state and verify active report counts still match current moderation behavior after migration.

## 2. Active report counting and threshold semantics

- [x] 2.1 Add failing backend tests showing that auto-hide thresholds count only pending reports and stop counting resolved reports.
- [x] 2.2 Update report counting, threshold evaluation, and concurrent report handling so only active pending reports contribute to auto-hide behavior.
- [x] 2.3 Add regression coverage for repeated reporting after prior resolution and for concurrent duplicate submissions against the same target.

## 3. Moderator resolution workflow

- [x] 3.1 Add failing service and route tests for moderator dismissal of a reported target without content mutation, including non-moderator rejection.
- [x] 3.2 Update moderator artwork and comment actions so hide and delete resolve active reports as `actioned`, and false-positive review paths resolve them as `reviewed` with reviewer attribution.
- [x] 3.3 Implement the bounded no-action dismissal path needed to close pending reports on a target without changing the target content.

## 4. Queue and read-model integration

- [x] 4.1 Add failing read-model tests showing the moderation queue lists only targets with active pending reports and drops resolved targets until new pending reports arrive.
- [x] 4.2 Update moderation queue aggregation, pagination, and route behavior to operate on active unresolved report state rather than historical total reports.
- [x] 4.3 Add integration coverage that moderator review decisions keep queue membership, hidden-state visibility, and target detail reads consistent.

## 5. Quality validation

- [x] 5.1 Run `bun run format`, `bun run lint`, `bun run check`, `bun run test:unit`, and `bun run test:e2e` and resolve any failures related to the change.