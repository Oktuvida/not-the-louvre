## 1. Engagement persistence foundations

- [ ] 1.1 Add schema and migration support for votes, comments, engagement rate limits, and any required artwork engagement summary fields.
- [ ] 1.2 Extend repository types and database access layers for vote state, comment lifecycle, and engagement-summary persistence.
- [ ] 1.3 Add failing schema/repository tests that describe one-vote-per-user rules, chronological comments, and durable engagement limit state.

## 2. Vote domain behavior

- [ ] 2.1 Add failing service tests for vote creation, vote replacement, vote removal, ownership/auth requirements, and vote abuse protection.
- [ ] 2.2 Implement vote application services and route handlers for authenticated vote transitions.
- [ ] 2.3 Ensure artwork score stays consistent after every vote transition and validate the behavior with automated tests.

## 3. Comment domain behavior

- [ ] 3.1 Add failing service and endpoint tests for comment creation, chronological reads, author deletion, contract validation, and comment abuse protection.
- [ ] 3.2 Implement comment services and route handlers for create/list/delete flows.
- [ ] 3.3 Ensure artwork comment counts stay consistent after comment creation and deletion and validate the behavior with automated tests.

## 4. Read-model enrichment

- [ ] 4.1 Add failing read-model tests covering `score` and `commentCount` on feed-card and artwork-detail projections.
- [ ] 4.2 Extend artwork discovery/detail queries and projection types to expose engagement summary fields.
- [ ] 4.3 Verify enriched artwork reads remain compatible with the current pagination and not-found semantics.

## 5. End-to-end validation

- [ ] 5.1 Add or update backend route/integration tests that exercise vote/comment flows through the public server boundaries.
- [ ] 5.2 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` and resolve any failures.
