## 1. Avatar upload, replacement, and deletion

- [ ] 1.1 Add failing tests for avatar upload validation (AVIF enforcement, size budget, authentication, replacement cleanup).
- [ ] 1.2 Implement avatar upload service with AVIF validation, storage persistence, profile update, and compensating cleanup on replacement.
- [ ] 1.3 Add avatar deletion service and verify old storage is cleaned up.
- [ ] 1.4 Add avatar upload and deletion route handlers at the server boundary.

## 2. Avatar media serving

- [ ] 2.1 Add failing tests for avatar media endpoint (serve existing avatar, 404 for missing avatar, 404 for nonexistent user).
- [ ] 2.2 Implement avatar media serving endpoint at `/api/users/[userId]/avatar` with cache headers and storage key resolution.

## 3. Moderation queue

- [ ] 3.1 Add failing tests for moderation queue listing (moderator access, non-moderator rejection, report count ordering, pagination, exclusion of zero-report content).
- [ ] 3.2 Implement moderation queue read model that aggregates report counts across artworks and comments with target context.
- [ ] 3.3 Add moderation queue route handler with cursor-based pagination and moderator authorization.

## 4. Quality validation

- [ ] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` and resolve any failures.
