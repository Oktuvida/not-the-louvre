## 1. Reporting and hidden-state foundations

- [x] 1.1 Add schema and migration support for reports and any hidden-state fields required by artworks and comments.
- [x] 1.2 Extend repository types and persistence access for report creation, target lookup, report counting, and hidden-state transitions.
- [x] 1.3 Add failing schema/repository tests for report target integrity, threshold counting, and hidden-state persistence.

## 2. Report submission and auto-hide behavior

- [x] 2.1 Add failing service tests for authenticated report submission, invalid target rejection, and threshold-triggered auto-hide for artworks and comments.
- [x] 2.2 Implement report submission behavior and threshold-based visibility transitions for reportable content.
- [x] 2.3 Validate with automated tests that hidden-state transitions integrate correctly with existing artwork/comment deletion semantics.

## 3. Moderation actions and visibility semantics

- [x] 3.1 Add failing tests for moderator hide, unhide, and delete actions plus non-moderator rejection.
- [x] 3.2 Implement moderator action services and server boundaries for artworks and comments.
- [x] 3.3 Update discovery/detail/comment read paths to enforce public hidden-content filtering and authorized moderator/owner visibility semantics.

## 4. Quality validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` and resolve any failures.
