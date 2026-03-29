# Centralized Text Moderation and NSFW Gating

**Date:** 2026-03-29
**Status:** Proposed

## Goal

Replace the current client-heavy moderation direction with a backend-authoritative
system that:

- validates artwork titles with the same text policy as nicknames and comments
- removes `NSFWJS` from avatar and artwork flows
- introduces creator-applied NSFW artwork labeling with blur-by-default reveal
- persists +18 consent in backend with user revocation available at any time
- stores blacklist and whitelist policy in the database, editable by admins and
  consumable by backend and frontend at runtime

## Why

The current direction has three structural problems:

1. `NSFWJS` performs poorly on drawings, creating false positives and hurting
   the core creative flow.
2. Text moderation policy is effectively hardcoded in the client, which means
   policy changes require rebuilds and redeploys.
3. Artwork titles are not moderated even though nicknames and comments already
   have a moderation path.

The replacement should preserve fast UX while moving policy authority and
enforcement to the backend.

## Decisions Confirmed

- Blacklist and whitelist are editable only by `admin` users.
- Nicknames, comments, and artwork titles share the same moderation engine and
  the same policy source.
- +18 consent is persisted in backend for authenticated users.
- Consent revocation must apply globally and immediately across all devices.
- `NSFWJS` is removed from the product.
- Artworks can be intentionally labeled NSFW by creators.
- Moderators can mark artworks and avatars as NSFW, hide/delete content, and
  ban abusive profiles.

### Required PRD / Schema Alignment

Before implementation planning begins, the product data model should explicitly
include:

- a moderation policy table for blacklist/whitelist storage
- an adult-content consent table for persisted reveal state
- `nsfw_labeled_at` on artworks

These are not optional implementation details; they are part of the required
domain model for this change.

## Scope

This change will:

- add backend-authoritative text moderation for `nickname`, `comment`, and
  `artwork-title`
- move blacklist/whitelist storage into database-backed admin-managed policy
- expose a frontend snapshot of the policy for early UX validation
- add DB state for NSFW artwork labeling and moderator overrides
- add backend-persisted +18 consent and global revocation
- replace automatic image detection with blurred NSFW rendering and reveal flow
- remove `NSFWJS` and related image moderation logic from the app

This change will not:

- introduce automatic image classification as a fallback
- add per-artwork reveal consent records
- add anonymous cross-device consent persistence
- implement a full moderation analytics system
- add policy variants by locale or tenant for MVP

## Recommended Approach

Use a single backend moderation authority with a read-only frontend snapshot.

```text
DB policy -> backend moderation authority -> frontend policy snapshot for UX
DB NSFW state -> backend read models -> frontend blur/reveal rendering
DB consent -> backend preference authority -> global reveal/revoke behavior
```

This keeps the real trust boundary in backend code while still allowing fast
client-side feedback for forms.

## Architecture

### 1. Policy Store

Add a database-backed policy source that stores blacklist and whitelist terms as
product moderation data.

Responsibilities:

- persist current blacklist and whitelist
- track who changed policy and when
- version the policy so the frontend can detect staleness
- serve as the only source of truth for text moderation policy

### 2. Moderation Service

Add a backend moderation service that:

- loads the policy store
- evaluates text for contexts `nickname`, `comment`, and `artwork-title`
- returns context-aware product messages
- is called from all write paths before persistence

Matching semantics for MVP:

- use one shared phrase-aware engine for backend and frontend snapshot consumers
- match normalized full terms and normalized multi-word phrases
- do not use naive raw substring matching across arbitrary character spans
- whitelist exceptions are evaluated against the same normalized phrase-aware
  representation before blacklist blocking is applied

This service replaces client-only authority. Frontend validation becomes a UX
optimization, not the deciding layer.

### 3. Frontend Policy Snapshot

Expose a backend-derived, read-only snapshot for the frontend to support early
validation during typing or before submit.

Requirements:

- consumable without admin privileges by normal product flows that need it
- versioned so the UI can reason about stale policy
- derived from backend policy data, never hand-maintained in frontend code
- safe to invalidate without breaking write correctness because backend still
  revalidates

### 4. NSFW Visibility Layer

Replace `NSFWJS` with explicit NSFW state and reveal gating.

Responsibilities:

- creators may label artworks as NSFW at publish time or later
- NSFW artworks are blurred by default in browse/detail surfaces
- authenticated viewers reveal them only after explicit +18 confirmation
- consent is stored in backend and may be revoked at any time
- revocation re-applies blur everywhere immediately for the authenticated user

### 5. Moderator Controls

Moderation actions must support:

- mark artwork NSFW
- mark avatar NSFW
- hide/unhide content
- delete content and backing media
- ban/unban profiles

Moderator changes override creator intent when necessary.

## Data Model

### Text Moderation Policy

Add a table such as `moderation_text_policy` with one global row for MVP.

Suggested fields:

- `id`
- `blacklist_terms`
- `whitelist_terms`
- `version`
- `updated_by`
- `updated_at`

Policy rule precedence:

- whitelist wins over blacklist for exact intended exceptions
- normalized comparisons are used by the backend moderation engine

Normalization rules are part of the contract, not an implementation detail.
For MVP, backend and frontend snapshot consumers must apply the same pipeline:

1. Unicode normalization with `NFKC`
2. trim leading and trailing whitespace
3. collapse consecutive internal whitespace to a single space
4. locale-insensitive lowercase/casefold comparison
5. do not strip punctuation or diacritics implicitly

This keeps behavior predictable and avoids frontend/backend drift.

### Artwork NSFW State

Add persisted artwork fields:

- `is_nsfw`
- `nsfw_source` with values `creator` or `moderator`
- `nsfw_labeled_at`

This lets the product distinguish between honest creator labeling and moderator
correction.

### Avatar/Profile Moderation State

Add or preserve profile-level moderation fields:

- `avatar_is_nsfw`
- `avatar_is_hidden`
- `is_banned`
- `banned_at`
- `ban_reason`

### Adult Content Consent State

Add a dedicated table such as `adult_content_consents` or
`viewer_content_preferences`.

Suggested fields:

- `user_id`
- `nsfw_reveal_enabled`
- `consented_at`
- `revoked_at`
- `updated_at`

This is preferable to burying the state in the main `users` row because it
preserves clean semantics and auditability.

Consent state machine for MVP:

- no row: user has never granted consent
- row with `nsfw_reveal_enabled = true`, `consented_at != null`, `revoked_at = null`:
  active consent
- row with `nsfw_reveal_enabled = false`, `consented_at != null`, `revoked_at != null`:
  previously consented and later revoked

Transition rules:

- first consent creates the row and sets `nsfw_reveal_enabled = true`
- revocation updates the row, sets `nsfw_reveal_enabled = false`, and stamps
  `revoked_at`
- re-consent updates the existing row, sets `nsfw_reveal_enabled = true`, stamps
  a new `consented_at`, and clears `revoked_at`

The current state is authoritative from `nsfw_reveal_enabled`; timestamps exist
for auditability and UX decisions.

## Backend Contracts

### Text Moderation Enforcement

The moderation service must run on these server-side writes:

- signup nickname creation
- comment creation
- artwork publish title
- artwork title update

If backend moderation is unavailable for these writes, the operation should fail
closed.

### Policy Admin Surface

Add an admin-only surface to:

- read current blacklist and whitelist
- edit them
- publish changes
- inspect last update metadata

For MVP, use a simple admin form with bulk list editing and immediate publish.
Concurrent updates should be protected with policy version checks so admins do
not overwrite each other silently.

Concurrency rule for MVP:

- policy updates use optimistic concurrency with compare-and-swap semantics
- the admin client submits the last observed `version`
- the backend rejects the write if the stored version no longer matches
- the client then reloads current policy and asks the admin to reconcile

### Policy Snapshot Surface

Add a read surface for the frontend snapshot containing:

- current policy version
- derived data needed for local UX validation
- no admin mutation capability

For MVP, this can be exposed through a backend bootstrap/read endpoint or page
data contract, but the returned shape should explicitly include:

- `version`
- `contexts` supported by the policy snapshot
- derived blacklist/whitelist data needed by the frontend matcher
- optional `updatedAt` metadata for debugging and invalidation behavior

### NSFW Consent Surface

Add backend actions to:

- read current authenticated user consent state
- accept +18 reveal consent
- revoke consent

Revocation must be globally authoritative for the user and reflected across
devices immediately.

### Moderator Controls Surface

Add backend actions for moderator operations on artworks, avatars, and profiles.

Required actions:

- mark artwork as NSFW
- mark avatar as NSFW
- hide/unhide artwork or comment
- delete artwork/comment/avatar media
- ban/unban profile

Authorization rules for MVP:

- `moderator` and `admin` can invoke moderator-control endpoints
- `admin` alone can edit blacklist/whitelist policy
- all moderator-control writes must be server-authorized from session identity,
  never from client-declared role state

## Frontend Behavior

### Signup Nickname

- use the shared text moderation snapshot for early feedback
- continue server-side enforcement at submit time
- show context-specific error copy when backend rejects the nickname
- this is part of signup validation, not login or recovery validation

### Comments

- use the same policy engine and source as other text contexts
- allow early client feedback when snapshot is present
- always trust backend rejection over client assumptions

### Artwork Titles

- artwork publish and title edit use the same text moderation policy as
  nicknames and comments
- title validation remains separate from structural constraints such as max
  length
- backend rejection must surface clearly in the publish/edit UI

### NSFW Artwork Rendering

In feed, gallery, and detail views:

- `is_nsfw = false`: render normally
- `is_nsfw = true` and no consent: render blurred artwork with badge and reveal
  CTA
- `is_nsfw = true` and consent enabled: render normally

### Consent UX

- the first reveal requires explicit +18 confirmation
- accepting stores backend consent for the authenticated user
- revoking consent is always available in product settings or equivalent
- revocation globally re-hides NSFW content for that user

## Error Handling

### Text Moderation Snapshot Unavailable

If the frontend snapshot cannot be loaded:

- the UI falls back to submit-time validation
- the write still proceeds through backend moderation
- frontend must not invent policy defaults that diverge from backend authority

This fallback behavior is part of the product contract, not an implementation
accident.

### Backend Moderation Unavailable

For writes affecting `nickname`, `comment`, or `artwork-title`:

- fail closed
- return a stable product-facing error

Failure handling must still be explicit per context:

- `nickname`: signup fails closed, the account is not created, and the user
  remains on the auth form with contextual error feedback
- `comment`: comment creation fails closed, no comment is persisted, and the
  user keeps their draft body in the UI
- `artwork-title` on publish: publish fails closed, no artwork record is
  created, and the title error is shown in the publish flow
- `artwork-title` on title update: update fails closed and the previous stored
  title remains unchanged

### Consent State Unavailable

If consent state cannot be read at bootstrap:

- default to `no consent`
- keep NSFW content blurred

### Revocation Concurrency

Consent revocation endpoints must be idempotent and safe across multiple active
sessions.

## Migration and Replacement Strategy

1. Introduce DB policy tables and backend moderation service.
2. Move text moderation authority from frontend to backend.
3. Add frontend snapshot consumption.
4. Extend publish and title-update flows with `artwork-title` moderation.
5. Add NSFW state fields and consent persistence tables.
6. Replace image moderation UI behavior with creator labeling + blur/reveal.
7. Remove `NSFWJS` dependencies, code paths, and related tests.

Legacy NSFWJS migration rule:

- no automatic NSFWJS classification result should survive as authoritative
  moderation state
- if any legacy prototype data already stores an NSFW flag that came from human
  moderation, migrate it as `nsfw_source = 'moderator'`
- if a legacy flag came only from automatic NSFWJS classification, drop it and
  require explicit creator labeling or moderator review going forward

## Testing Strategy

### Unit Tests

- blacklist/whitelist precedence
- normalization behavior
- context-aware moderation result mapping
- NSFW consent state transitions

### Integration Tests

- signup rejects blocked nickname
- comment rejects blocked body
- publish rejects blocked artwork title
- title update rejects blocked artwork title
- admin policy update changes subsequent backend decisions
- consent accept/revoke updates authenticated read state

### Component Tests

- publish form surfaces blocked title errors
- NSFW artwork cards/details blur correctly without consent
- reveal CTA stores consent and unblurs content
- revocation returns the UI to blurred state

### End-to-End Tests

- admin updates blacklist/whitelist and normal user sees new behavior
- user publishes NSFW artwork and sees blur in feed/detail without consent
- authenticated viewer accepts reveal gate and sees NSFW artwork unblurred
- viewer revokes consent and blur returns across subsequent navigation
- moderator marks artwork or avatar NSFW and resulting surfaces update correctly

If a moderator later hides or deletes content, moderator visibility rules
override reveal consent. Consent allows viewing NSFW content, not hidden or
removed content.

## Files and Areas Expected to Change

- backend moderation service and validation paths
- auth nickname write path
- artwork publish and artwork title update flows
- comment write path
- DB schema and migrations for moderation policy, NSFW state, and consent state
- admin moderation/policy surfaces
- frontend forms consuming policy snapshot
- gallery/feed/detail rendering for blur/reveal
- tests across unit, integration, component, and e2e layers

## Risks and Tradeoffs

- Sending a frontend snapshot improves UX but introduces version drift risk;
  backend authority must always win.
- A global consent flag is simpler and more consistent than per-artwork consent,
  but it is broader in scope and therefore must be easy to revoke.
- Removing `NSFWJS` improves creative UX but shifts more burden to creator
  honesty and moderation tooling.
- Admin-editable policy increases operational flexibility but requires careful
  authorization and auditability.

## Recommendation

Proceed with a backend-authoritative moderation model using:

- DB-backed admin-managed blacklist/whitelist
- one shared text engine for nickname, comment, and artwork title
- creator-applied NSFW labels plus moderator overrides
- backend-persisted global +18 consent with immediate revocation

This is the smallest design that satisfies the product decisions without
leaving authority in the client.