## 1. Public user profile

- [x] 1.1 Add failing tests for public user profile endpoint (existing user, nonexistent user, unauthenticated access, avatar URL resolution).
- [x] 1.2 Extend `UserRepository` with profile read and implement the profile service and route handler at `GET /api/users/[userId]`.

## 2. Admin user listing

- [x] 2.1 Add failing tests for admin user listing (admin access, non-admin rejection, unauthenticated rejection, pagination, cursor continuation).
- [x] 2.2 Extend `UserRepository` with `listUsers` and implement admin listing service and route handler at `GET /api/admin/users`.

## 3. Admin role assignment

- [x] 3.1 Add failing tests for role assignment (promote to moderator, demote to user, self-change rejected, admin-target rejected, non-admin rejected, nonexistent user).
- [x] 3.2 Extend `UserRepository` with `updateUserRole` and implement role assignment service and route handler at `PATCH /api/admin/users/[userId]`.
- [x] 3.3 Add `INVALID_ROLE` error code to `ArtworkFlowError`.

## 4. Quality validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` and resolve any failures.
