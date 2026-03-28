## 1. Deterministic e2e harness

- [x] 1.1 Add failing Playwright-oriented tests that describe the need for deterministic backend setup or reset before each user journey.
- [x] 1.2 Implement a guarded test-only setup/reset mechanism for Playwright runs and wire it into shared e2e helpers without exposing it in normal runtime.
- [x] 1.3 Add any required fixture assets or seed utilities so the first browser journeys can run repeatedly in local development and CI.

## 2. Minimal demo route contract

- [x] 2.1 Refine the existing `/demo` index and auth demo surfaces so they expose stable labels, actions, and visible backend outcomes for browser assertions.
- [x] 2.2 Add a minimal artwork-focused demo route that drives one authenticated backend flow through the running SvelteKit application.
- [x] 2.3 Add or update server-side tests around the new demo-backed flow boundaries where route or action behavior needs explicit regression coverage.

## 3. User-journey end-to-end coverage

- [x] 3.1 Add failing Playwright coverage for the full nickname-auth journey through the real browser runtime, including signup, logout, recovery, and post-recovery login.
- [x] 3.2 Add failing Playwright coverage for the first authenticated artwork journey and make the minimum code changes needed for the journey to pass.
- [x] 3.3 Refactor shared e2e helpers, selectors, and setup code so additional backend journeys can reuse the pattern without duplicating harness logic.

## 4. Quality validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` and resolve any failures related to the new backend e2e layer.