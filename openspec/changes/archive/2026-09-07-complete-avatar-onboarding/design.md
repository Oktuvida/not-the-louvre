## Context

The previous auth-wiring change made signup, recovery, session bootstrap, and logout real on the home route, but deliberately left the avatar sketch step as UI-only. Today `apps/web/src/lib/features/home-entry-scene/components/AvatarSketchpad.svelte` simulates saving, never persists avatar media, and simply dispatches the user into the signed-in scene. That leaves a broken product path: account creation succeeds, but the final onboarding step cannot complete real work and becomes a dead end if the user expects their avatar to exist later.

There is already a backend avatar capability in place: `apps/web/src/routes/api/users/[userId]/avatar/+server.ts` and `apps/web/src/lib/server/user/avatar.service.ts` accept authenticated avatar uploads, sanitize media, store a canonical avatar object, and update the user record. The gap is therefore product wiring and onboarding state management, not raw avatar storage.

The main constraint is that backend avatar upload is strict: it accepts canonical AVIF at configured dimensions and size. The current sketch UI draws on a large freeform canvas, so completion requires a product-side export path that produces valid avatar media before submission. A second constraint is onboarding continuity: we need a way to know whether an authenticated user has completed avatar onboarding, rather than inferring it only from temporary local UI state.

## Goals / Non-Goals

**Goals:**
- Make the home avatar step persist a real avatar through the existing backend avatar boundary.
- Define a durable onboarding completion signal so reloads and later visits resolve consistently.
- Keep the existing staged signup flow shape: recovery key acknowledgement, avatar step, then entry into the signed-in scene.
- Add clear error and retry behavior for unsupported export, invalid avatar payloads, and failed saves.
- Cover the completed onboarding flow with route, component, and browser tests.

**Non-Goals:**
- Redesigning the avatar sketch UI or replacing the drawing tool interaction model.
- Generalizing onboarding for every future post-signup step beyond avatar completion.
- Replacing the existing avatar storage or sanitization pipeline.
- Introducing a separate public profile editor flow in this change.

## Decisions

### 1. Add a dedicated home-route avatar completion action instead of calling the avatar API endpoint directly from the browser

The home route will grow a named server action for avatar completion, likely `saveAvatar`, which accepts the generated avatar file and delegates to the existing avatar service. The avatar sketch step remains part of the `/` route flow, and the page action returns updated onboarding and canonical user state for the same UI that already owns signup progression.

Why this decision:
- It keeps the home onboarding flow on one server boundary, matching the auth flow that now lives in `+page.server.ts`.
- It avoids teaching the product overlay to construct user-id-specific API URLs while it is still inside a same-page onboarding ceremony.
- It gives the route one place to shape avatar save failures into view-level form state.

Alternatives considered:
- Call `PUT /api/users/[userId]/avatar` directly from the browser: rejected because it splits onboarding state across two transport patterns and forces the component to understand a lower-level endpoint contract.
- Keep avatar persistence as a follow-up background sync after entry: rejected because the user has already hit a dead-end and needs deterministic completion before leaving the onboarding step.

### 2. Persist onboarding completion on the product user record instead of inferring it from temporary client state

The product user model should gain durable onboarding completion state, such as `avatarOnboardingCompletedAt` or an equivalent boolean/timestamp marker. Successful avatar save sets that state. Home bootstrap then derives whether an authenticated user should enter the inside scene immediately or resume/continue avatar onboarding.

Why this decision:
- It makes reloads, new tabs, and later sessions consistent without relying on transient UI state.
- It avoids forcing all historical users without avatars into the onboarding step unless the product explicitly marks them incomplete.
- It gives future product logic a stable distinction between “no avatar yet” and “avatar onboarding intentionally completed/skipped.”

Alternatives considered:
- Treat `avatarUrl === null` as incomplete onboarding: rejected because it would retroactively trap existing or admin-created users who legitimately have no avatar.
- Store completion only in session or local storage: rejected because it breaks cross-tab consistency and is too fragile for a core account state transition.

### 3. Export the sketch canvas into canonical avatar media in the client before submission

`AvatarSketchpad.svelte` should convert the current drawing into the canonical avatar payload expected by the backend before submitting. The export path should render into a 256x256 staging canvas (matching backend requirements), produce an AVIF blob when supported, and submit that blob as a `File` through the home-route action. If the browser cannot produce AVIF, the UI should surface a clear unsupported-save error and keep the user on the avatar step with retry guidance.

Why this decision:
- The backend contract already enforces AVIF, dimensions, and size; the product step must align with that contract instead of sending arbitrary canvas data.
- A client-side export path lets the user stay in the sketch UI without introducing a new server-side rasterization service in this change.
- It keeps the existing backend sanitization as the source of truth while making the browser produce inputs the backend can accept.

Alternatives considered:
- Loosen the backend avatar contract to accept PNG or raw canvas data: rejected because it would weaken an already-specified capability and spread sanitization concerns.
- Add a separate server-side canvas-to-avatar conversion endpoint: rejected because it adds another media boundary when the browser can already export the needed payload in supported environments.

### 4. Model avatar onboarding as a resumable signed-in state, not a fake unauthenticated branch

After signup succeeds, the user is still authenticated on the server. The home route should therefore distinguish between authenticated-and-onboarded and authenticated-but-avatar-incomplete states. `EntrySceneController.svelte` should continue to hold the overlay open for the avatar step when onboarding is incomplete, and the server bootstrap should restore that path when the durable onboarding marker says the user still needs to finish it.

Why this decision:
- It preserves backend truth: the user is signed in even while still inside onboarding.
- It prevents dead ends after refresh because the route can deliberately reopen the correct step.
- It keeps logout and other signed-in behaviors consistent with the real session while still blocking full entry until completion.

Alternatives considered:
- Pretend the user is signed out until avatar save finishes: rejected because it fights the real session contract and creates contradictory state after signup.
- Allow immediate full entry and make avatar optional later: rejected because the user asked to complete the onboarding flow, not silently abandon it.

### 5. Add explicit save-failure, retry, and escape-path handling in the avatar step

The avatar step should surface save status, backend validation errors, and unsupported-browser export failures directly in place. The user must be able to retry saving without losing the sketch unexpectedly. Design-wise, the safest default is to keep the user in the avatar step until save succeeds or they explicitly sign out, rather than silently dropping them into the inside scene with incomplete onboarding.

Why this decision:
- The current dead-end is partly a feedback problem; completion needs visible success/failure states.
- Backend avatar validation is strict, so user-facing retry handling is part of the real product contract.
- This keeps onboarding deterministic and debuggable in tests.

Alternatives considered:
- Auto-clear the sketch after a failed save: rejected because it destroys user work.
- Fallback to fake success when avatar save fails: rejected because it recreates the same trust gap we just removed from auth.

## Risks / Trade-offs

- [Browser AVIF export support varies] -> Mitigation: explicitly detect export failure, keep the user on the avatar step, and provide a recoverable unsupported-save message.
- [A new onboarding completion field adds schema work] -> Mitigation: keep the field narrowly scoped to avatar onboarding and migrate existing users with a safe default that preserves current behavior.
- [Home-route `+page.server.ts` keeps growing] -> Mitigation: isolate avatar completion mapping/helpers so the route action surface stays thin even if the file remains the orchestration point.
- [Resuming incomplete onboarding after refresh could feel surprising] -> Mitigation: only resume when the durable onboarding marker says the current authenticated user has not completed avatar onboarding.
- [Client-side export may produce payloads near size limits] -> Mitigation: export to canonical dimensions and let backend validation remain authoritative, with clear retry messaging when the save is rejected.

## Migration Plan

1. Add failing tests that describe avatar onboarding completion, persistence, reload bootstrap, and save-failure behavior on the home route.
2. Add any required user-schema support for durable onboarding completion state and migrate existing users safely.
3. Extend the home-route server load and actions to expose avatar onboarding bootstrap and save handling through the existing page action contract.
4. Refactor `AvatarSketchpad.svelte`, `AuthOverlay.svelte`, and `EntrySceneController.svelte` to submit real avatar media, handle failures, and resume incomplete onboarding.
5. Update Playwright signup journeys to verify avatar persistence, reload continuity, and successful entry into the home scene.
6. Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.

Rollback:
- Remove the home-route avatar completion wiring and restore the current presentation-only avatar step if the flow becomes unstable.
- If a schema field is added for onboarding completion, keep rollback data-safe by leaving the field unused rather than mutating existing user records back.

## Open Questions

- Whether the product should eventually support an explicit “skip avatar for now” path, or require avatar completion as part of signup for the foreseeable future.
- Whether browser-side AVIF export is reliable enough across the project’s supported browsers, or whether a later follow-up should add a server-side conversion boundary for broader compatibility.
