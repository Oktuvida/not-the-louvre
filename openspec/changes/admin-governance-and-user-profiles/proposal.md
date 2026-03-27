## Why

The backend has no admin-facing user management and no public user profile endpoint. Moderators are assigned by directly editing the database, and the frontend has no way to render a user's public profile (nickname, avatar, role, join date). This blocks the admin dashboard (PRD §8.3 "assigned by admins"), profile pages, and author-detail views.

## What Changes

- Add a public user profile read endpoint that returns a user's public-facing information (nickname, avatar URL, role, join date) without exposing sensitive fields.
- Add an admin user listing endpoint with cursor-based pagination for managing the user base.
- Add an admin role management endpoint to promote users to moderator or demote them back to user.
- Enforce admin-only authorization on governance endpoints.
- Add tests for all new endpoints and authorization boundaries.

## Capabilities

### New Capabilities
- `user-profiles`: Public user profile read model and serving endpoint.
- `admin-user-management`: Admin-only user listing and role assignment.

### Modified Capabilities
- `identity-and-access`: The canonical authenticated product identity requirement needs to be extended — admin role must be usable for governance authorization checks, and the role field must support admin-initiated mutations (not just default assignment at signup).

## Impact

- New route handlers under `/api/users/[userId]` (GET profile) and `/api/admin/users` (GET list, PATCH role).
- New `UserReadRepository` methods or extensions to existing `UserRepository`.
- Existing `ArtworkFlowError` or a new `UserFlowError` for user/admin domain errors.
- No schema migration expected — the `role` enum already includes `admin` and `moderator`.
