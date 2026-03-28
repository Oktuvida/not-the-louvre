## 1. Home Route Auth Contract

- [ ] 1.1 Add failing server-route tests for the new home auth `load` and action contract, covering signed-out bootstrap, existing-session bootstrap, sign in, sign up, recovery, sign out, and integrity-failure handling.
- [ ] 1.2 Implement `apps/web/src/routes/+page.server.ts` so the home route exposes canonical auth bootstrap data plus thin server actions backed by the existing auth services.
- [ ] 1.3 Centralize home-route auth failure mapping so backend `message` and `code` values are preserved consistently for login, signup, recovery, nickname availability, and logout flows.

## 2. Overlay And Scene Wiring

- [ ] 2.1 Add failing component tests that describe how `EntrySceneController.svelte`, `AuthOverlay.svelte`, and `PersistentNav.svelte` should react to real server data and action results instead of mock local auth state.
- [ ] 2.2 Refactor `EntrySceneController.svelte` to initialize from server-provided auth bootstrap data, derive signed-in identity from canonical user data, and let logout be driven by the backend sign-out action.
- [ ] 2.3 Replace the mocked submit and availability logic in `AuthOverlay.svelte` with real form submissions and debounced same-origin nickname checks while preserving the current login, signup, recovery, key-acknowledgement, and avatar-step views.
- [ ] 2.4 Update `PersistentNav.svelte` and any related home-entry components so signed-in chrome and logout behavior come from real backend session state rather than local nickname memory.

## 3. End-To-End Auth Journeys

- [ ] 3.1 Update the home-route Playwright journeys to run against deterministic backend state and fail first when the product auth flow is still mocked.
- [ ] 3.2 Implement the real home-route browser journeys for sign in, sign up with backend-issued recovery key acknowledgement, recovery with rotated key, existing-session bootstrap, and logout.
- [ ] 3.3 Add or update any shared e2e helpers needed to reset auth state and seed deterministic auth users without leaking test-only behavior into normal runtime.

## 4. Validation

- [ ] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` and resolve any failures caused by the auth wiring change.
