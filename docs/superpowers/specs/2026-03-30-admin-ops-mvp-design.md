# Admin Ops MVP

**Date:** 2026-03-30
**Status:** Proposed

## Goal

Close the current governance gap with a small internal operations surface that lets
the team actually run moderation and user administration without inventing a full
governance platform.

The MVP should provide:

- admin-managed user role changes and soft bans
- moderator/admin content moderation for artworks, comments, and avatars
- moderator/admin NSFW labeling where moderator NSFW immediately hides the target
- one internal dashboard with tabs for users, moderation queue, and text policy

## Why

The backend already contains useful pieces of admin and moderation behavior, but
they stop short of an operable internal tool.

Current state:

- admins can list users and change roles between `user` and `moderator`
- admins can edit text moderation policy
- moderators and admins can review the moderation queue and hide/unhide/delete
  reported artworks and comments
- artwork and user schema already include ban and NSFW-related fields that are not
  fully wired into domain behavior
- there is no admin/moderation dashboard UI in the product

This leaves the product in an awkward middle state: policy and queue primitives
exist, but common operations such as banning abusive users or marking avatars as
NSFW still require manual database work or are not possible at all.

## Decisions Confirmed

- This is an internal ops MVP, not a full governance platform.
- `admin` manages users and policy.
- `moderator` moderates content.
- `admin` inherits moderation abilities.
- User bans are `soft` bans.
- A soft-banned user may still authenticate and read, but cannot publish artwork,
  comment, vote, or upload/replace an avatar.
- Moderator-applied NSFW implies hidden state immediately.
- The dashboard is a single internal area with tabs:
  - `Users`
  - `Moderation Queue`
  - `Text Policy`
- The current server-route trust boundary remains the primary authorization layer.

## Scope

This change will:

- add admin ban and unban behavior over existing user fields
- enforce soft-banned restrictions across the core authenticated write paths
- add moderator/admin artwork NSFW moderation actions
- add moderator/admin avatar moderation actions
- extend user/admin read models so the dashboard can show sanction and avatar
  moderation state
- add a single internal dashboard with three tabs and role-aware visibility

This change will not:

- introduce a full audit timeline or governance analytics system
- add deletion of avatar media from the moderation dashboard
- redesign the product around DB-first RLS for all moderation/admin behavior
- create a public-facing moderation tool
- add advanced moderation search, saved filters, or queue assignment workflows

## Recommended Approach

Extend the existing backend seams instead of inventing a new governance stack.

```text
admin.service       -> users tab actions and admin-only policy
artwork.service     -> content moderation actions
avatar moderation   -> user/profile moderation actions
shared ban guard    -> authenticated write-path enforcement
dashboard route     -> one internal UI with role-gated tabs
```

This keeps the MVP aligned with the current architecture:

- admin-only behavior stays in admin services and routes
- moderator/admin content operations stay in moderation-oriented services
- UI remains thin and backend-authoritative

## Architecture

### 1. User Administration

Extend the current admin domain with sanction actions in addition to role changes.

Required capabilities:

- list users with role, avatar status, and ban status
- promote `user -> moderator`
- demote `moderator -> user`
- ban a user with a required reason
- unban a user

Role rules for MVP:

- only `admin` can manage roles and bans
- admins cannot change their own role
- admins cannot change another admin's role
- admins cannot ban themselves through the internal tool
- banning does not change role
- a banned `moderator` or `admin` loses effective privileged access while banned

Privilege resolution rule:

- privilege checks are evaluated only for authenticated users who are not banned
- a banned privileged user is treated as non-operational for dashboard and mutation
  purposes until unbanned

Suggested user list projection additions:

- `isBanned`
- `bannedAt`
- `banReason`
- `avatarIsHidden`
- `avatarIsNsfw`

### 2. Soft-Ban Enforcement

Soft ban should be centralized as a reusable backend assertion instead of copied
ad hoc into each route.

Enforcement target for MVP:

- artwork publish
- artwork update when such edit flow exists
- artwork vote
- artwork comment create
- artwork moderation actions
- avatar moderation actions
- avatar upload/replace
- admin role and ban mutations

Explicit non-targets for MVP:

- read-only discovery and profile routes
- authentication itself
- non-mutating moderation/admin read models

Behavior:

- authenticated banned users receive a consistent forbidden response
- read-only routes remain available
- no session invalidation is required for MVP
- privileged dashboard access is denied while the actor is banned

Race-window note:

- banning is enforced at request evaluation time
- if a write began before the ban was applied and already passed authorization,
  that in-flight request may still complete
- this is acceptable for MVP and should be documented, not treated as a hidden
  guarantee

Recommended error contract:

- HTTP `403`
- stable code such as `BANNED_USER`
- product-safe message such as `This account cannot perform this action.`

### 3. Artwork Moderation Extensions

The artwork moderation boundary already supports `hide`, `unhide`, `dismiss`, and
`delete`. Extend it with explicit NSFW moderation.

New actions:

- `mark_nsfw`
- `clear_nsfw`

`mark_nsfw` contract:

- set `isNsfw = true`
- set `nsfwSource = 'moderator'`
- set `nsfwLabeledAt = now`
- set `isHidden = true`
- set `hiddenAt = now` when not already hidden

`clear_nsfw` contract:

- clear moderator-applied NSFW state
- do not automatically unhide the artwork

Keeping `unhide` separate avoids accidentally republishing content just because a
moderator wants to change its classification.

### 4. Avatar Moderation

Add an explicit avatar moderation surface over the already-present user fields.

Required actions:

- `hide`
- `unhide`
- `mark_nsfw`
- `clear_nsfw`

Authorization rule:

- any active `moderator` or `admin` may moderate any user's avatar
- avatar moderation is not limited to self-service or ownership

`mark_nsfw` contract:

- set `avatarIsNsfw = true`
- set `avatarIsHidden = true`

`clear_nsfw` contract:

- clear the NSFW marker
- do not automatically unhide the avatar

Self-targeting rule:

- moderators and admins may moderate their own avatar if required
- self-moderation is allowed because avatar moderation is a content safety action,
  not a privilege mutation

Serving behavior:

- avatar-serving reads must respect `avatarIsHidden`
- a hidden avatar should resolve as absent media for normal product surfaces
- moderator/admin tooling may still display state through the admin dashboard read
  model rather than through the public avatar-serving endpoint

### 5. Single Internal Dashboard

Create one internal area with tabbed navigation.

Tabs:

- `Users`
- `Moderation Queue`
- `Text Policy`

Visibility rules:

- `admin` sees all tabs
- `moderator` sees only `Moderation Queue`
- non-privileged users cannot access the area
- banned users cannot access the internal area, even if their persisted role is
  `moderator` or `admin`

The UI is not a security boundary. Route and service authorization remain the
authoritative control.

## Backend Contracts

### Users

#### `GET /api/admin/users`

Keep the existing endpoint and extend the response items with:

- `isBanned`
- `bannedAt`
- `banReason`
- `avatarIsHidden`
- `avatarIsNsfw`

The endpoint remains admin-only and paginated.

#### `PATCH /api/admin/users/[userId]`

Keep the existing role update endpoint for role mutation only.

Request body:

```json
{ "role": "moderator" }
```

or

```json
{ "role": "user" }
```

#### `PATCH /api/admin/users/[userId]/ban`

Add a new admin-only sanction endpoint.

Request bodies:

```json
{ "action": "ban", "reason": "harassment and repeated evasion" }
```

```json
{ "action": "unban" }
```

Why a separate endpoint:

- role mutation and sanction mutation are different policies
- it keeps request validation and audit semantics simpler

Response contract:

- `200` with the updated user projection on success
- `400` for malformed action or missing required reason
- `403` when the actor is not an active admin or tries to ban themselves
- `404` when the target user does not exist

Reason rules:

- `reason` is required for `ban`
- `reason` is optional and ignored for `unban`
- `banReason` is visible in the admin user projection and internal dashboard only

#### Viewer ban-state contract

The frontend needs a reliable way to know whether the current authenticated user
is banned.

Preferred MVP rule:

- expose `isBanned` in the authenticated viewer/session payload already used by
  the frontend

Fallback if the current frontend auth bridge does not expose it:

- add a minimal authenticated viewer-status endpoint rather than duplicating ban
  logic in each screen

### Artworks

#### `PATCH /api/artworks/[artworkId]/moderation`

Extend the action enum to:

- `hide`
- `unhide`
- `dismiss`
- `mark_nsfw`
- `clear_nsfw`

#### `DELETE /api/artworks/[artworkId]/moderation`

Keep delete as a dedicated delete operation.

Additional rules:

- any active `moderator` or `admin` may moderate any artwork, including their own
- moderation actions are idempotent where practical
- repeated `mark_nsfw`, `clear_nsfw`, `hide`, or `unhide` should return success
  with the resulting current state instead of failing for already-applied state
- this MVP uses last-write-wins semantics rather than optimistic concurrency for
  content moderation actions

### Comments

#### `PATCH /api/artworks/[artworkId]/comments/[commentId]/moderation`

Keep:

- `hide`
- `unhide`
- `dismiss`

#### `DELETE /api/artworks/[artworkId]/comments/[commentId]/moderation`

Keep delete.

Comment NSFW note:

- comments do not get NSFW classification in this MVP
- comment moderation remains `hide`, `unhide`, `dismiss`, and `delete` because the
  existing comment domain already treats problematic text as moderation/removal
  work rather than reveal-gated media classification

### Avatars

#### `PATCH /api/users/[userId]/avatar/moderation`

Add moderator/admin avatar moderation with actions:

- `hide`
- `unhide`
- `mark_nsfw`
- `clear_nsfw`

Do not add avatar delete for this MVP.

Response contract:

- `200` with updated avatar moderation state on success
- `403` when the actor is not an active moderator/admin
- `404` when the target user does not exist or has no product profile
- idempotent success for already-applied avatar state transitions

## UI Shape

### Users Tab

Audience: `admin`

Core table columns:

- nickname
- role
- created date
- banned state
- avatar state

Row actions:

- promote to moderator
- demote to user
- ban
- unban
- mark avatar NSFW
- clear avatar NSFW
- hide avatar
- unhide avatar

Filtering for MVP:

- role filter
- ban-state filter
- pagination using the existing backend cursor contract

### Moderation Queue Tab

Audience: `moderator`, `admin`

Reuses the existing moderation queue ordering and pagination.

Each item should show:

- target type
- author nickname
- short content preview
- hidden state
- report count

Actions by target type:

- artwork: `hide`, `unhide`, `delete`, `mark NSFW`, `clear NSFW`, `dismiss`
- comment: `hide`, `unhide`, `delete`, `dismiss`

Avatar moderation entry point:

- avatar moderation is launched from the `Users` tab rather than mixed into the
  report queue because avatars are not currently queued by the reporting read model

### Text Policy Tab

Audience: `admin`

Reuses the current admin text-policy backend.

The MVP UI can stay intentionally plain:

- one panel per context (`nickname`, `comment`, `artwork_title`)
- editable allowlist and blocklist values
- optimistic concurrency through the existing expected version contract

## Error Handling

Principles:

- fail closed on missing authorization
- keep backend error codes stable enough for dashboard UI behavior
- avoid mixing moderation policy errors with generic write failures
- prefer returning the resulting resource state for idempotent moderation actions

Recommended domain errors for new work:

- `BANNED_USER`
- `FORBIDDEN`
- `NOT_FOUND`
- `INVALID_ROLE`
- `INVALID_ACTION`
- `VALIDATION_ERROR`

Recommended status mapping:

- `400` -> `INVALID_ACTION`, `VALIDATION_ERROR`
- `403` -> `FORBIDDEN`, `BANNED_USER`
- `404` -> `NOT_FOUND`

## Testing Strategy

### Unit / Service Tests

- admin service: ban, unban, cannot ban nonexistent user, cannot ban without admin
- shared write guard: banned user is rejected consistently
- artwork moderation service: `mark_nsfw`, `clear_nsfw`, hidden-state interaction
- avatar moderation service: hide/unhide and NSFW flows

### Route Tests

- new `/api/admin/users/[userId]/ban` route authorization and payload handling
- new `/api/users/[userId]/avatar/moderation` route authorization and actions
- updated artwork moderation route accepts new NSFW actions
- existing authenticated write routes reject banned users
- banned moderator/admin cannot access dashboard or privileged routes
- self-ban rejection for admins
- idempotent repeated moderation actions return success
- comment moderation remains limited to non-NSFW actions

### End-to-End Coverage

- admin can open dashboard, switch tabs, and ban/unban a user
- moderator can open dashboard and only see moderation queue
- moderator can mark an artwork NSFW from the queue
- banned user can still sign in but cannot publish/comment/vote/upload avatar
- banned moderator loses access to moderation UI until unbanned

## Rollout Order

1. Extend read models and admin service for sanctions and avatar state.
2. Add ban/unban backend and banned-user write guard.
3. Add artwork and avatar moderation actions.
4. Build the internal dashboard tabs on top of those contracts.
5. Add e2e coverage for the internal flows.

## Risks

- Spreading ban checks across routes would create policy drift.
  Mitigation: use one reusable backend assertion for banned-user mutation denial.

- Auto-unhiding when clearing NSFW would cause accidental re-publication.
  Mitigation: keep classification and visibility as separate moderator actions.

- Reusing public avatar-serving behavior for moderator review could leak hidden
  avatar assumptions into product surfaces.
  Mitigation: keep moderator state visibility in the admin read model, not in the
  public avatar-serving contract.

## Open Questions Deferred

- audit timeline for moderation and sanctions
- permanent avatar deletion from internal tools
- moderator-specific analytics, saved filters, and queue assignment
- richer ban scopes beyond the selected soft-ban behavior