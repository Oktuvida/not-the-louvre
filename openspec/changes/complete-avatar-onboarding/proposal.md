## Why

The home signup flow now creates real accounts and sessions, but the final avatar step is still a dead end: drawing works visually, yet nothing is persisted and the user cannot actually complete onboarding through a real backend save. We need to finish that last mile now so the product signup flow stops stalling after successful account creation.

## What Changes

- Wire the home avatar sketch step to the existing backend avatar upload capability instead of treating it as presentation-only UI.
- Define how the home route persists avatar media, completes onboarding, and re-enters cleanly after reloads or navigation.
- Establish error, retry, and recovery behavior for avatar save failures so users do not get trapped between an authenticated session and an incomplete onboarding screen.
- Add automated coverage that proves avatar onboarding persists data and exits into the signed-in home experience.

## Capabilities

### New Capabilities
- `frontend-avatar-onboarding`: Product-facing avatar onboarding flow that persists the signup avatar step, handles save failure and retry states, and completes entry into the signed-in experience.

### Modified Capabilities
- `avatar-management`: Extend avatar requirements so the product onboarding flow can save avatars through the existing backend contract and receive completion-safe responses.
- `identity-and-access`: Extend authenticated session requirements so avatar onboarding state resolves safely during reloads, returning sessions, and partially completed signup flows.

## Impact

- Affected code: `apps/web/src/lib/features/home-entry-scene/components/AvatarSketchpad.svelte`, `apps/web/src/lib/features/home-entry-scene/components/AuthOverlay.svelte`, `apps/web/src/lib/features/home-entry-scene/components/EntrySceneController.svelte`, `apps/web/src/routes/+page.server.ts`, and home-route tests.
- Affected backend boundaries: existing avatar upload endpoint at `apps/web/src/routes/api/users/[userId]/avatar/+server.ts`, avatar service and storage wiring under `apps/web/src/lib/server/user/`, and canonical auth bootstrap on the home route.
- Affected systems: signup completion UX, persisted avatar media, onboarding recovery after refresh, and browser journeys for newly created users.
- Dependencies: existing avatar sanitization and storage pipeline, canonical `event.locals.user` auth resolution, and the already-completed `frontend-auth-flow-wiring` change.
