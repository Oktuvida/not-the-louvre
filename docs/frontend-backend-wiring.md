# Frontend <-> Backend Wiring Guide

This document maps how the current backend already talks to the frontend, using the demo routes in `apps/web/src/routes/demo/` as the reference implementation. The goal is to give the real product UI one clear contract to wire against instead of inventing a second integration style.

## What Already Exists

The app is not missing backend behavior. It is missing consistent frontend wiring.

Today there are already three working integration patterns:

1. `+page.server.ts` loads for server-rendered page data and auth gating.
2. SvelteKit form actions for cookie-backed mutations that naturally redirect or re-render.
3. JSON API routes under `apps/web/src/routes/api/` for client-side fetches and realtime support.

The demo area proves these patterns end to end:

- `apps/web/src/routes/demo/better-auth/login/+page.server.ts`
- `apps/web/src/routes/demo/better-auth/+page.server.ts`
- `apps/web/src/routes/demo/artwork-publish/+page.server.ts`
- `apps/web/src/routes/demo/artwork-realtime-votes/+page.server.ts`
- `apps/web/src/routes/demo/artwork-realtime-votes/+page.svelte`

## Recommended Mental Model

Use this split consistently:

```text
Browser UI
   |
   | initial page / route navigation
   v
+-----------------------+
| SvelteKit load/action |
+-----------------------+
   |            \
   |             \ fetch for interactive updates
   v              v
+----------------+   +-------------------+
| server service |   | /api HTTP routes  |
+----------------+   +-------------------+
   |                       |
   +-----------+-----------+
               v
        domain services / db / storage / realtime
```

In plain terms:

- Use server `load` functions to decide what the page can see on first render.
- Use form actions when the frontend is doing a classic authenticated flow: sign in, sign up, publish, sign out.
- Use `/api` endpoints for in-page interactions that should not require a full navigation: voting, pagination, detail refreshes, realtime token exchange.

## Global Request Contract

Every request is normalized through `apps/web/src/hooks.server.ts`.

### Canonical auth state

The frontend never talks directly to Better Auth session internals. Backend route code consumes:

- `event.locals.user`: canonical product user
- `event.locals.authUser`: auth-engine user
- `event.locals.session`: current auth session
- `event.locals.integrityFailure`: valid auth session without companion product user

Defined in `apps/web/src/app.d.ts`.

### Important implication

Most backend routes are written against `event.locals.user`, not raw auth cookies. That means the frontend contract is:

- signed in -> backend sees a canonical product user
- signed out -> backend treats request as unauthenticated
- broken auth/profile pairing -> backend treats request as integrity failure

### State-changing request rule

Unsafe cookie-backed mutations are origin-hardened in `apps/web/src/hooks.server.ts`.

So frontend code should prefer same-origin requests made by:

- SvelteKit forms
- `fetch('/api/...')` from the app itself

and should avoid inventing cross-origin mutation patterns.

## Demo Patterns to Reuse

## 1. Auth flow pattern

Reference:

- `apps/web/src/routes/demo/better-auth/login/+page.server.ts`
- `apps/web/src/routes/demo/better-auth/login/+page.svelte`
- `apps/web/src/routes/demo/better-auth/+page.server.ts`

### How it works

```text
signed-out page
   -> form action
   -> backend validation
   -> auth service call
   -> redirect on success
   -> fail(status, { message, code? }) on failure
```

### Actions exposed today

From `apps/web/src/routes/demo/better-auth/login/+page.server.ts`:

- `?/signIn`
- `?/signUp`
- `?/checkNickname`
- `?/recover`

From `apps/web/src/routes/demo/better-auth/+page.server.ts`:

- `?/signOut`

### Input rules

From `apps/web/src/lib/server/auth/validation.ts`:

- nickname: normalized to lowercase, `3-20` chars, `[a-z0-9_]`
- password: `8-128` chars
- recovery key: UUIDv4 string length

### Success shape

- sign in -> redirect to `/demo/better-auth`
- sign up -> redirect to `/demo/better-auth?recoveryKey=...`
- check nickname -> returns `{ availability: 'available' | 'taken' | 'invalid' }`
- recover -> returns `{ recoveryKey, rotatedRecoveryKey }`
- sign out -> redirect to `/demo/better-auth/login`

### Failure shape

Form actions return `fail(status, { message, code? })`.

Representative error codes:

- `NICKNAME_TAKEN`
- `INVALID_CREDENTIALS`
- `RECOVERY_FAILED`
- `RATE_LIMITED`
- `INTEGRITY_FAILURE`

### Product wiring takeaway

For auth, the cleanest first wiring is still SvelteKit server actions, not ad hoc browser-side JSON auth calls. The demo already shows the correct cookie/session behavior.

## 2. Artwork publish pattern

Reference:

- `apps/web/src/routes/demo/artwork-publish/+page.server.ts`
- `apps/web/src/routes/demo/artwork-publish/+page.svelte`
- `apps/web/src/routes/api/artworks/+server.ts`

This capability exists in two forms:

1. page action form for full-page UX
2. JSON API for programmatic use

### Server-load contract

`apps/web/src/routes/demo/artwork-publish/+page.server.ts` shows the expected page bootstrap:

- reject integrity failure with `500`
- redirect anonymous user to login
- fetch discovery feed with `listArtworkDiscovery(...)`
- optionally fetch a newly published artwork with `getArtworkDetail(...)`

Returned page data:

- `user`
- `feed`
- `publishedArtwork`

### Form action contract

`?/publish` expects multipart form data:

- `title`
- `media`

On success:

- redirects to `/demo/artwork-publish?published=<artworkId>`

On failure:

- returns `fail(status, { message, code? })`

### JSON API contract

From `apps/web/src/routes/api/artworks/+server.ts`:

#### `POST /api/artworks`

Multipart form data:

- `title?: string`
- `parentArtworkId?: string`
- `media: File`

Success:

```json
{
  "artwork": {
    "id": "artwork-1"
  }
}
```

Status: `201`

Failure:

```json
{
  "code": "INVALID_MEDIA_FORMAT",
  "message": "..."
}
```

#### `GET /api/artworks`

Query params:

- `sort=recent|hot|top`
- `window=day|week|all` when required by ranked views
- `cursor=<opaque>`
- `limit=<number>`

Success shape:

```json
{
  "items": [
    {
      "id": "artwork-1",
      "title": "Recent artwork",
      "mediaUrl": "/api/artworks/artwork-1/media",
      "score": 4,
      "commentCount": 2,
      "forkCount": 3,
      "author": {
        "id": "user-1",
        "nickname": "artist_1",
        "avatarUrl": null
      },
      "lineage": {
        "isFork": false,
        "parent": null,
        "parentStatus": "none"
      }
    }
  ],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "cursor-1"
  },
  "sort": "recent"
}
```

### Validation constraints worth designing around

From `apps/web/src/lib/server/artwork/config.ts` and `apps/web/src/lib/server/artwork/validation.ts`:

- title max length: `100`
- empty publish title is allowed and becomes `Untitled #NNNN`
- media must sanitize to canonical still `image/avif`
- canonical dimensions: `1024x1024`
- max stored size: `100 * 1024` bytes

### Product wiring takeaway

- initial gallery/discovery page -> use `load`
- publish modal/page -> start with SvelteKit form action if redirect/readback is acceptable
- richer publishing UI later -> target `POST /api/artworks`

## 3. Artwork detail and vote pattern

Reference:

- `apps/web/src/routes/api/artworks/[artworkId]/+server.ts`
- `apps/web/src/routes/api/artworks/[artworkId]/vote/+server.ts`
- `apps/web/src/routes/demo/artwork-realtime-votes/+page.svelte`

### Detail API

#### `GET /api/artworks/:artworkId`

Success shape:

```json
{
  "artwork": {
    "id": "artwork-1",
    "title": "Detail artwork",
    "mediaUrl": "/api/artworks/artwork-1/media",
    "score": 7,
    "commentCount": 3,
    "forkCount": 1,
    "lineage": {
      "isFork": true,
      "parentStatus": "available",
      "parent": {
        "id": "artwork-parent",
        "title": "Parent artwork"
      }
    },
    "childForks": [
      {
        "id": "artwork-2",
        "title": "Child fork",
        "mediaUrl": "/api/artworks/artwork-2/media"
      }
    ],
    "author": {
      "id": "user-1",
      "nickname": "artist_1",
      "avatarUrl": null
    }
  }
}
```

#### `PATCH /api/artworks/:artworkId`

JSON body:

```json
{ "title": "New title" }
```

Returns `{ artwork }`.

#### `DELETE /api/artworks/:artworkId`

Returns `{ artwork }` for the deleted artwork.

### Vote API

#### `POST /api/artworks/:artworkId/vote`

JSON body:

```json
{ "value": "up" }
```

Current domain type also allows `down`, but the demo only exercises `up` plus removal.

Success shape:

```json
{
  "artwork": {
    "id": "artwork-1",
    "score": 1,
    "commentCount": 0
  },
  "vote": {
    "id": "vote-1",
    "artworkId": "artwork-1",
    "userId": "user-1",
    "value": "up"
  }
}
```

#### `DELETE /api/artworks/:artworkId/vote`

Success shape:

```json
{
  "artwork": {
    "id": "artwork-1",
    "score": 0,
    "commentCount": 0
  },
  "removed": null
}
```

### Product wiring takeaway

This is the clearest example of when the frontend should call JSON APIs directly: the action is local, interactive, and should not navigate.

## 4. Media delivery pattern

Reference:

- `apps/web/src/routes/api/artworks/[artworkId]/media/+server.ts`

Use application URLs for artwork media, not direct storage URLs.

#### `GET /api/artworks/:artworkId/media`

Behavior:

- backend resolves artwork visibility
- backend streams storage object
- response sets `content-type`
- response sets `cache-control: public, max-age=31536000, immutable`

### Product wiring takeaway

Frontend components should treat `mediaUrl` from the API as the canonical image source. Do not reconstruct bucket URLs on the client.

## 5. Realtime handshake pattern

Reference:

- `apps/web/src/routes/demo/artwork-realtime-votes/+page.server.ts`
- `apps/web/src/routes/demo/artwork-realtime-votes/+page.svelte`
- `apps/web/src/routes/api/realtime/token/+server.ts`
- `apps/web/src/lib/server/realtime/auth.ts`

This is the most important non-obvious wiring pattern in the repo.

### Bootstrap contract

The page load provides browser-safe realtime config only:

- `realtimeConfig.url`
- `realtimeConfig.anonKey`

The browser never receives the realtime signing secret.

### Token exchange

#### `GET /api/realtime/token`

Requires authenticated user.

Unauthenticated failure:

```json
{
  "code": "UNAUTHENTICATED",
  "message": "Authentication required"
}
```

Success:

```json
{
  "token": "signed-realtime-token",
  "expiresAt": "2026-03-28T16:30:00.000Z"
}
```

### Browser subscription sequence

```text
page load
  -> read realtimeConfig from server load
  -> GET /api/realtime/token
  -> create Supabase browser client with anon key + public URL
  -> supabase.realtime.setAuth(token)
  -> subscribe to postgres_changes
  -> update local UI from scoped payloads
```

In the demo, the browser subscribes to table:

- schema: `app`
- table: `artwork_vote_realtime`

and filters client-side to the tracked artwork.

### Product wiring takeaway

Use realtime only as a narrow live-update layer on top of canonical HTTP reads. Initial state still comes from `load` or `GET /api/artworks/:id`.

## Error Contract

Across JSON API routes, the backend consistently prefers:

```json
{
  "code": "SOME_MACHINE_CODE",
  "message": "Human-readable message"
}
```

Across SvelteKit form actions, the backend consistently prefers:

```ts
fail(status, {
  code?: string,
  message: string
})
```

This is the contract the product UI should normalize around.

For artwork flows, known error codes are centralized in `apps/web/src/lib/server/artwork/errors.ts`.

## Practical Wiring Plan For The Real App

If the goal is to move from mock frontend to working app without rewriting the backend contract, the safest sequence is:

1. Reuse server `load` functions for page bootstrap and auth gating.
2. Reuse form actions for auth and first-pass publish flows.
3. Add thin frontend API clients for `/api/artworks`, `/api/artworks/:id`, `/api/artworks/:id/vote`, and `/api/realtime/token`.
4. Treat backend-returned `mediaUrl` as canonical.
5. Layer realtime only where the page already has a canonical artwork id and initial score.

## Suggested Frontend Boundary Rules

To avoid the frontend and backend drifting apart, use these rules:

- auth pages talk to server actions first
- route entry data comes from `load`, not duplicate client boot fetches
- in-place interactive mutations use `/api`
- realtime never replaces canonical reads; it only patches live state
- frontend should render both `message` and optional `code` from backend failures
- frontend should assume `event.locals.user` is the real source of auth truth, not local client state

## Demo-to-Product Mapping

| Need in product UI | Demo proof | Backend boundary to reuse |
| --- | --- | --- |
| sign up / sign in / recover / sign out | `demo/better-auth` | server actions in `demo/better-auth/**` pattern, backed by auth service |
| authenticated gallery bootstrap | `demo/artwork-publish` load | `listArtworkDiscovery(...)` via `load` or `GET /api/artworks` |
| publish artwork | `demo/artwork-publish` action | `?/publish` pattern first, later `POST /api/artworks` |
| artwork detail page | realtime demo tracked artwork load | `GET /api/artworks/:artworkId` |
| vote interaction | realtime demo buttons | `POST/DELETE /api/artworks/:artworkId/vote` |
| live score updates | realtime demo subscription | `GET /api/realtime/token` + Supabase channel |

## The Main Architectural Decision

The important decision is not "how do we call the backend?"

It is:

```text
Do we standardize on the backend contract that already exists,
or do we create a second frontend-specific contract?
```

The demos strongly suggest the right answer is:

- keep SvelteKit server loads/actions as the first-class app boundary
- use JSON API routes for rich client interactions
- keep domain logic in services, not in components

That gives the future product UI a stable shape without waiting for any backend rewrite.
