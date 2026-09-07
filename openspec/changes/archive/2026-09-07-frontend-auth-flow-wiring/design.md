## Context

The home route at `apps/web/src/routes/+page.svelte` currently renders the animated entry scene and a visually complete auth overlay, but the auth behavior is still mocked inside `apps/web/src/lib/features/home-entry-scene/components/AuthOverlay.svelte`. The component locally fabricates nickname availability, login success, signup recovery keys, recovery success, and signed-in identity without talking to the backend contract that already exists in `apps/web/src/routes/demo/better-auth/**`, `apps/web/src/hooks.server.ts`, and `$lib/server/auth/service`.

That gap is now the main blocker for wiring the rest of the app. If the home route continues inventing its own auth truth, every later screen will need bespoke reconciliation between client state and `event.locals.user`. This change should make the real auth flow available through the current production-facing home experience while preserving the existing scene, overlay choreography, and staged signup UX.

The current signup experience also includes a recovery-key acknowledgement step and an avatar sketch step. The backend auth flow already supports signup and recovery-key issuance, but avatar persistence is a separate slice with its own backend contract. This design therefore needs to cleanly separate “real auth is complete” from “post-signup avatar onboarding polish continues in the UI.”

## Goals / Non-Goals

**Goals:**
- Wire the home auth overlay to the real nickname-based auth backend without replacing the current visual scene or interaction model.
- Bootstrap the home route from canonical server auth state so signed-in vs signed-out rendering comes from `event.locals.user`, not local component memory.
- Reuse the existing auth backend contract for sign in, sign up, nickname availability, recovery, and sign out.
- Preserve the current recovery-key acknowledgement and avatar-step UX where it does not conflict with backend truth.
- Define precise error and edge-case handling for invalid credentials, duplicate nicknames, invalid recovery attempts, rate limits, integrity failures, and returning sessions.
- Add automated coverage that proves the product route now uses the real backend flow instead of the mocked overlay logic.

**Non-Goals:**
- Reworking the visual design, motion system, or scene composition of the home entry experience.
- Introducing a second frontend-specific auth API when the existing SvelteKit auth boundary is sufficient.
- Wiring avatar upload or persistence in this change.
- Solving auth gating for every route in the app beyond the session bootstrap needed to make the home auth flow real.

## Decisions

### 1. Put the real auth mutations on the home route with SvelteKit server actions

The home route will gain a `+page.server.ts` that exposes the same core action surface already proven in the demo flow: sign in, sign up, check nickname, recover, and sign out. The overlay remains mounted on `/`, but its forms stop simulating network work and instead submit to the route’s server actions.

Why this decision:
- It reuses the backend contract that already behaves correctly with cookies, redirects, and `event.locals.user`.
- It avoids introducing a parallel JSON auth client before the product auth flow is stable.
- It keeps auth mutations same-origin and aligned with the trusted-origin protections in `apps/web/src/hooks.server.ts`.

Alternatives considered:
- Add brand-new `/api/auth/*` endpoints for the product UI: rejected because the existing action contract already covers the needed flows and adding a second boundary would create drift.
- Call Better Auth directly from the browser: rejected because product code should stay anchored to the canonical server-side user contract rather than auth-engine internals.

### 2. Bootstrap the home experience from server data, then let the scene state machine reflect that truth

The home route will load a small auth bootstrap payload derived from `event.locals.user`, `event.locals.authUser`, and `event.locals.integrityFailure`. `EntrySceneController.svelte` will initialize the entry state from that payload instead of defaulting to local `outside` plus a manually stored nickname. A valid existing session will enter the `inside` view immediately; a signed-out request will remain `outside`; an integrity failure will render a safe blocked state rather than a fake signed-in experience.

Why this decision:
- The existing state machine already supports `SESSION_EXISTS`; it just is not fed by real server data yet.
- Signed-in UI such as `PersistentNav.svelte` should display backend identity, not stale client memory.
- This keeps refresh behavior correct: if the user signs in, reloads, or opens a new tab, the route still resolves consistently.

Alternatives considered:
- Keep a purely client-side nickname store and only use server actions for mutations: rejected because it still allows drift between frontend state and the backend session.
- Move all auth bootstrap into a new global layout server load in this slice: rejected for now because the immediate requirement is the home auth flow, and a page-local bootstrap keeps the first wiring change narrower.

### 3. Keep the current staged signup UX, but treat backend signup as the source of truth

After successful signup, the backend has already created the account and session. The overlay will therefore display the real returned recovery key, require explicit acknowledgement, and may continue into the existing avatar sketch step for continuity, but backend auth completion is not contingent on finishing avatar onboarding. If the page reloads during or after that step, the user will resolve as signed in based on server state.

Why this decision:
- It preserves the current product feel without pretending signup is incomplete when the server session already exists.
- It avoids bundling avatar persistence into the first auth wiring slice.
- It makes one-time recovery-key display depend on real backend data rather than mock generation.

Alternatives considered:
- Remove the avatar step entirely: rejected because it would unnecessarily regress the current experience.
- Block auth completion until avatar onboarding is saved: rejected because avatar persistence is out of scope and would make auth correctness depend on unfinished functionality.

### 4. Keep nickname availability as a live overlay affordance, backed by the real server action

The signup overlay will continue to show live nickname availability, but the result will come from the backend `checkNickname` action rather than the component’s local `takenNicknames` set. The product implementation can use a small debounced enhanced submission helper to call the same-origin action and update local availability state without leaving the overlay context.

Why this decision:
- It preserves an interaction the current UI already teaches users to expect.
- It ensures availability messaging matches the same normalization and validation rules as signup.
- It keeps the implementation on the same route/action contract rather than introducing a separate availability source.

Alternatives considered:
- Only validate nickname at submit time: rejected because it degrades the current onboarding experience and makes duplicate-name failures feel abrupt.
- Add a dedicated availability JSON endpoint immediately: rejected because the action contract is already sufficient for the first slice.

### 5. Normalize overlay error handling around backend `message` and `code`

The overlay will stop owning bespoke auth failure text as its primary source. Instead it will map backend action results to view-specific messages while preserving machine-readable codes for branching. `RATE_LIMITED`, `NICKNAME_TAKEN`, `INVALID_CREDENTIALS`, `RECOVERY_FAILED`, and integrity failures become explicit UI cases. Unknown failures fall back to a generic network or server error state without breaking the overlay.

Why this decision:
- The backend already returns a stable `message` plus optional `code` contract.
- The overlay needs different visual placements for field errors, global form errors, and cooldown messaging.
- This keeps frontend behavior aligned with the backend contract instead of duplicating error policy.

Alternatives considered:
- Hard-code all messages in the component and ignore backend codes: rejected because it will drift immediately as backend rules evolve.
- Surface raw backend payloads without UI mapping: rejected because the experience needs readable, context-aware presentation.

### 6. Cover the wiring with a mix of route tests, component tests, and browser journeys

The first failing tests should describe business outcomes on the real home route: a user signs in through `/`, a visitor signs up and is shown the returned recovery key, a recovering user gets a replacement key, an existing session re-enters as signed in, and sign out clears the session. Route tests will pin the new `+page.server.ts` contracts; component tests will pin result-to-view behavior inside the overlay; Playwright will verify the home route uses the real backend rather than local mocks.

Why this decision:
- The current mocked overlay already has component and e2e tests that can be turned into real contract tests rather than thrown away.
- Auth correctness depends on both server behavior and the home-scene UI state transitions.
- This follows the repository’s test-first requirement and keeps the new wiring reproducible.

Alternatives considered:
- Rely only on component tests: rejected because they would miss real cookies, redirects, and server auth state.
- Rely only on Playwright: rejected because edge-case mapping is easier to pin quickly in route and component tests.

## Risks / Trade-offs

- Signup success plus avatar onboarding creates a temporary split between “authenticated on the server” and “finished with signup ceremony in the overlay.” -> Mitigation: make acknowledgement and avatar continuation purely presentation state, and always let reload/session bootstrap win.
- Debounced availability checks can race and show stale results. -> Mitigation: keep request tokens or cancellation semantics in the overlay and ignore late responses that no longer match the current nickname.
- Home-route action growth can make `+page.server.ts` dense. -> Mitigation: keep actions thin, delegate to existing auth services, and centralize shared error-to-failure mapping.
- Integrity failures may produce an awkward user-facing state if left undefined. -> Mitigation: explicitly model an integrity-failure branch in the home bootstrap and render a safe blocked message with no partial signed-in UI.
- Logout behavior tied only to local callbacks could leave the backend session alive. -> Mitigation: replace client-only logout callbacks with a real sign-out action and let the reloaded server state reset the scene.

## Migration Plan

1. Add failing tests for the home route auth actions, session bootstrap, and overlay result handling.
2. Introduce home-route server load and actions that wrap the existing backend auth contract.
3. Refactor `EntrySceneController.svelte`, `AuthOverlay.svelte`, and `PersistentNav.svelte` so they consume server data and form/action results instead of mock auth state.
4. Replace mocked availability, login, signup, recovery, and logout behavior with real submissions while preserving the current staged UI.
5. Update Playwright home-route journeys to run against deterministic backend state and verify the real auth outcomes.
6. Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.

Rollback:
- Remove the home-route server auth wiring and restore the existing mocked overlay behavior if the product route becomes unstable.
- Because this change does not alter the backend auth domain contract, rollback is isolated to the product frontend wiring and associated tests.

## Open Questions

- Whether the home auth actions should remain page-local long term or later be lifted into a shared layout or dedicated auth route once more routes need the same bootstrap data.
- Whether the avatar step after signup should remain mandatory for entering the home scene, or become skippable once avatar persistence is wired in a later change.
