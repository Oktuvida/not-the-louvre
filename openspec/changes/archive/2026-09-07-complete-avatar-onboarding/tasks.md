## 1. Avatar Onboarding Contract

- [x] 1.1 Add failing home-route server tests for avatar onboarding bootstrap and the new avatar completion action, covering authenticated-but-incomplete users, successful avatar save, save failure mapping, and completed-onboarding bootstrap.
- [x] 1.2 Add any required schema and migration support for durable avatar onboarding completion state on the product user record, then update canonical auth/user types and repositories to expose it.
- [x] 1.3 Extend `apps/web/src/routes/+page.server.ts` with thin avatar completion handling that delegates to the existing avatar service and returns consistent action data for onboarding success and failure cases.

## 2. Avatar Step Wiring

- [x] 2.1 Add failing component tests for `AvatarSketchpad.svelte`, `AuthOverlay.svelte`, and `EntrySceneController.svelte` that describe successful avatar save, retryable failure, unsupported export, and reload/bootstrap resumption behavior.
- [x] 2.2 Refactor `AvatarSketchpad.svelte` to export the sketch into canonical avatar media, submit it through the home-route action, preserve the sketch on failure, and surface save-state feedback.
- [x] 2.3 Update `AuthOverlay.svelte` and `EntrySceneController.svelte` so authenticated-but-incomplete users remain in avatar onboarding until save succeeds, while completed users enter the signed-in home scene immediately.

## 3. End-To-End Coverage

- [x] 3.1 Update the home-route Playwright signup journey to verify avatar persistence, onboarding completion, and successful entry into the signed-in scene.
- [x] 3.2 Add browser coverage for reloading or reopening the home route during incomplete avatar onboarding and resuming the correct step.
- [x] 3.3 Add coverage for avatar save failure and retry handling without leaking test-only behavior into the runtime flow.

## 4. Validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, and resolve any failures caused by the avatar onboarding completion change.
