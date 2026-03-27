## Context

The backend has user records with `role` (user/moderator/admin) but no endpoints for viewing profiles or managing roles. The `UserRepository` was introduced in the avatar-pipeline change with `findUserById` and `updateUserAvatarUrl`. The existing `ArtworkFlowError` pattern provides typed error codes. Admin endpoints don't exist yet.

## Goals / Non-Goals

**Goals:**
- Expose public user profiles at a REST endpoint.
- Enable admins to list users and assign roles.
- Reuse existing repository and error patterns.
- Lock down all governance endpoints to admin-only access.

**Non-Goals:**
- User self-service profile editing (nickname changes, etc.).
- Admin user deletion or suspension.
- Notification to users when their role changes.
- Pagination on profile endpoints (single-user reads).

## Decisions

### 1. Public profile endpoint at GET /api/users/[userId]

Returns nickname, resolved avatar URL, role, and `createdAt`. No authentication required. Resolves avatar storage key to the serving endpoint URL, consistent with how `toAuthorSummary` works in `read.service.ts`.

**Alternative considered:** Include profile data in the existing artwork author summaries only. Rejected because profile pages and admin views need standalone user data.

### 2. Admin endpoints under /api/admin/users

`GET /api/admin/users` lists users with cursor-based pagination (cursor = createdAt + id, newest first). `PATCH /api/admin/users/[userId]` changes the user's role.

**Alternative considered:** Put admin endpoints under `/api/users` with role-based guards. Rejected because a separate `/api/admin/` namespace makes authorization intent explicit at the routing level.

### 3. Extend UserRepository with listing and role update methods

Add `listUsers(input)` and `updateUserRole(id, role, updatedAt)` to the existing `UserRepository` type in `user/types.ts`. The repository already has the Drizzle wiring for the `users` table.

**Alternative considered:** Separate `AdminRepository`. Rejected because the operations are on the same `users` table and adding another repository introduces unnecessary indirection.

### 4. Reuse ArtworkFlowError for user domain errors

The `ArtworkFlowError` class is a general-purpose typed error with status + code. Rather than creating `UserFlowError`, reuse the same class. The error codes already include `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`. Add `INVALID_ROLE` for invalid role values.

**Alternative considered:** A new `UserFlowError` class. Rejected because the error structure is identical and there's no behavioral difference.

### 5. Role change guards: no self-mutation, no admin-to-admin changes

The role assignment endpoint checks: (1) requester must be admin, (2) requester cannot change their own role, (3) target user must not be admin. Only `user` ↔ `moderator` transitions are allowed. This prevents accidental privilege escalation or lockout.

### 6. Public profile resolves avatar URL like read.service.ts

The user profile service uses the same `resolveAvatarUrl(userId, storageKey)` pattern from `read.service.ts` — if the user has a storage key, return `/api/users/{userId}/avatar`, otherwise null.

## Risks / Trade-offs

- **No admin creation endpoint** — First admin must be seeded via DB. This is acceptable for MVP since admin is a rare role.
- **ArtworkFlowError reuse might feel wrong as the codebase grows** — Mitigated by the plan to extract to a shared `FlowError` if a third domain appears. For now, two domains sharing one error class is fine.

## Migration Plan

1. Extend `UserRepository` type with `listUsers` and `updateUserRole`.
2. Add public profile service and route handler.
3. Add admin user listing service and route handler.
4. Add admin role assignment service and route handler.
5. Add `INVALID_ROLE` error code.
6. Tests for all new behavior.
7. Run quality gates.

**Rollback:** Remove new route handlers and repository methods. No schema change to revert.

## Open Questions

- Should the public profile include the user's artwork count for display purposes, or is that a separate query the frontend composes?
