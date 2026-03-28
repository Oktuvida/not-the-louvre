## 1. Realtime contract tests

- [x] 1.1 Add failing backend tests that describe artwork-scoped realtime vote delivery and rejection of unrelated artwork events.
- [x] 1.2 Add failing backend tests that describe artwork-scoped realtime comment delivery for create, hide, unhide, and delete transitions.
- [x] 1.3 Add failing verification tests for least-privilege realtime exposure, including required RLS and denial of unauthorized subscriptions.

## 2. Database-owned counter and moderation invariants

- [x] 2.1 Add failing schema or integration tests for canonical `score` maintenance across vote insert, update, and delete flows under concurrent mutation.
- [x] 2.2 Add failing schema or integration tests for canonical public `commentCount` maintenance across comment create, hide, unhide, and delete transitions.
- [x] 2.3 Add failing schema or integration tests for canonical public `forkCount` maintenance across fork create, hide, unhide, and delete transitions.
- [x] 2.4 Add failing integration tests for report-threshold auto-hide behavior under concurrent submissions against the same artwork or comment.
- [x] 2.5 Implement migrations and database-side logic that own the derived counters and atomic auto-hide transition rules.

## 3. Realtime-safe exposure

- [x] 3.1 Implement the minimal realtime-facing relation exposure, publication setup, grants, and RLS policies for artwork vote and comment events.
- [x] 3.2 Ensure realtime payload shape excludes backend-only columns and matches the client detail-view needs.
- [x] 3.3 Update backend read and service boundaries where needed so public discovery/detail projections stay consistent with the new DB-owned invariants.

## 4. Integration validation

- [x] 4.1 Add or update route/integration tests that verify vote, comment, moderation, and reporting flows still behave correctly with DB-owned counters.
- [x] 4.2 Add integration coverage for public-versus-moderator visibility semantics after hide and unhide transitions.
- [x] 4.3 Run `bun run format`, `bun run lint`, `bun run check`, `bun run test:unit`, and `bun run test:e2e` and resolve any failures.