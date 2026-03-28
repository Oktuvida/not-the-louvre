# Artwork Realtime Vote Demo Design

## Goal

Add a minimal demo and Playwright journey that proves real browser-side vote
updates arrive through Supabase Realtime without page refresh or test-driven
manual refetch.

## Why

The backend already models secure realtime vote relations in the database, but
there is no frontend demo surface or end-to-end test that proves an author can
observe score changes live while another authenticated user votes and removes
that vote from a separate browser context.

This design turns the existing database capability into an observable browser
contract.

## Scope

The change will:

- add a dedicated demo route for artwork vote realtime observation
- let the observing user publish a demo artwork and stay on its detail-like
  view
- subscribe the observing page to the realtime-safe vote relation for that one
  artwork
- expose visible subscription state, current score, and a small event log for
  debugging
- allow a second authenticated browser context to upvote and remove its vote on
  the same artwork through the same demo surface
- add a Playwright e2e that verifies score changes `0 -> 1 -> 0` without a page
  refresh for the observing user

The change will not:

- build a production artwork detail page
- expand realtime coverage to comments in the same slice
- add broad optimistic UI logic for the main app
- replace the existing API vote tests or database contract tests

## User Journey

The approved scenario is:

1. User A signs up and opens the realtime vote demo.
2. User A publishes a demo artwork from that page.
3. The page shows the artwork id, current score, subscription status, and a
   realtime event log.
4. User B signs up in a second browser context and opens the same demo using the
   shared artwork id.
5. User B applies an upvote.
6. User A sees the score change from `0` to `1` without refresh.
7. User B removes the vote.
8. User A sees the score change from `1` to `0` without refresh.

## Recommended Approach

Use one dedicated route, for example `/demo/artwork-realtime-votes`, with two
entry modes:

- publish mode for the observing author
- observe-or-act mode when the route receives an existing artwork id

This keeps the demo focused on one artwork and one derived value. The route
should use the existing backend publish and vote boundaries instead of inventing
parallel logic.

## Alternatives Considered

### Reuse the artwork publish demo

Rejected because the publish demo is currently oriented around upload validation
and post-submit readback. Mixing realtime subscription, live score display, and
two-user interaction into that surface would blur responsibilities and make the
tests harder to debug.

### Build separate observer and actor demos

Rejected because it adds extra navigation and more UI surface without adding new
confidence. A single route that supports both contexts through the same
artwork-id contract is smaller and easier to maintain.

## Architecture

### Demo Route

Add a new route under `src/routes/demo/artwork-realtime-votes/`.

Its server load should:

- require an authenticated product user
- optionally read an `artworkId` query parameter
- if `artworkId` is present, load the artwork detail or summary needed for the
  score view
- otherwise render an empty state inviting the author to publish the tracked
  artwork

Its server actions should:

- publish an artwork using the existing artwork service
- redirect to the same route with the new `artworkId`

The second acting user does not need a dedicated server action for voting if the
demo can call the existing vote API route from the browser.

### Browser Realtime Client

The page component should:

- use a browser Supabase client introduced specifically for realtime
- create a Supabase browser client configured for realtime subscriptions
- subscribe only after an artwork id is known
- filter to the one artwork id the page is tracking
- update a local visible score value when vote-change events arrive
- render a small event log with the last few messages for debugging
- show subscription lifecycle text such as `connecting`, `subscribed`, or
  `errored`

The client should not subscribe to broad artwork streams. It should scope the
channel to one artwork id.

### Browser Auth Bridge For Realtime

Supabase Realtime cannot use the existing Better Auth session cookie directly.
This slice therefore needs an explicit authenticated token bridge for the
browser-side Supabase client.

The implementation should:

- introduce `@supabase/supabase-js` for browser subscriptions
- expose the browser-safe Supabase URL and anon key through public env
- add a narrow server endpoint or equivalent bridge that returns a signed JWT
  for the current authenticated user in a form Supabase Realtime can use
- initialize the browser Supabase client with that JWT before subscribing

This is a real prerequisite, not an optional refinement. Without it, the
browser subscription cannot satisfy the current realtime RLS policies.

### Visible Demo Contract

The page should expose stable, human-readable text for assertions:

- `Realtime subscription: subscribed`
- `Tracked artwork ID: ...`
- `Tracked artwork score: 0`
- `Tracked artwork score: 1`
- event log rows such as `Vote event: up from realtime` and
  `Vote event: removed from realtime`

The acting controls should remain minimal:

- `Publish tracked artwork`
- `Upvote tracked artwork`
- `Remove vote`

## Data Flow

### Publish Flow

1. Observer submits a valid artwork upload.
2. Server action publishes through the existing artwork service.
3. Route redirects to `?artworkId=<new id>`.
4. Page initializes the realtime subscription for that artwork.
5. Initial score is rendered from the server load result.

### Vote Flow

1. Actor opens the same route with the shared artwork id in a second browser
   context.
2. Actor triggers the existing vote API.
3. Database triggers update the canonical artwork score and realtime-safe vote
   relation.
4. Supabase Realtime emits the scoped event.
5. Observer client receives the event and updates visible score state without
   refresh.

The first implementation should prefer client-side score reconciliation from
scoped realtime events only. If delete-event handling proves too lossy in the
browser payload, the fallback is a narrow canonical score refetch triggered by
the event itself rather than test-driven polling.

### Vote Removal Flow

1. Actor removes the vote through the existing vote API.
2. Canonical score returns to the neutral value.
3. Realtime event is emitted again.
4. Observer client updates from `1` to `0` without reload.

## Error Handling

The demo should surface a few explicit states:

- unauthenticated access redirects to the existing nickname-auth demo login
- invalid or missing artwork id renders a visible not-found or unavailable state
- realtime subscription errors render `Realtime subscription: errored`
- vote API failures render a visible action error for the acting context

The observer page should keep the last known score visible even if the
subscription later errors.

## Testing Strategy

### Server Tests

Add focused route tests for:

- redirecting unauthenticated access
- loading a tracked artwork by id for an authenticated user
- publishing and redirecting to the tracked-artwork query contract

### End-to-End Test

Add one primary Playwright journey using two browser contexts:

- observer signs up and publishes artwork
- observer waits for visible subscription success
- actor signs up in a separate context and opens the same artwork
- actor upvotes
- observer sees score `1` without refresh
- actor removes vote
- observer sees score `0` without refresh

The test should not manually poll the API for the observer. It may wait on
visible text changes driven by the subscribed page itself.

## Risks And Mitigations

### Browser Supabase auth for realtime may be the hardest integration point

Mitigation:

- keep the first slice restricted to one route and one table subscription
- surface explicit subscription status text for fast debugging
- isolate the JWT bridge to the demo-supporting realtime path instead of
  entangling it with unrelated auth flows

### Event timing can make the Playwright journey flaky

Mitigation:

- wait for an explicit `subscribed` state before allowing the actor to vote
- keep assertions on visible state transitions rather than raw timing

### Score reconciliation could drift from canonical backend state

Mitigation:

- initialize the score from the server load
- update from tightly scoped realtime events only
- avoid deriving unrelated aggregates on the client in this slice

## Implementation Notes

- Prefer a new dedicated demo route over expanding the existing publish demo.
- Keep selectors and visible labels stable and literal.
- Reuse the deterministic auth and publish e2e helpers where practical.
- Reuse the current Playwright reset flow so the two-user scenario starts from a
  clean backend state every time.

## Open Questions

- Whether the JWT bridge should be exposed through a dedicated demo-supporting
  endpoint or through a more general browser auth token helper that future
  realtime demos can reuse.
- Whether the vote-event payload alone is enough for deterministic score updates
  or whether the demo should react by reading the canonical score from a narrow
  follow-up endpoint. The initial recommendation is to keep the slice as direct
  as possible and only add a follow-up read if the realtime payload proves too
  lossy.