## Why

The backend already carries most MVP behavior, but validation still leans heavily on server-level tests and isolated demos. The project needs a user-perspective end-to-end layer that exercises real server boundaries through minimal frontend surfaces, so backend contracts can be shaped and protected by realistic journeys instead of only internal test seams.

## What Changes

- Introduce a backend end-to-end testing capability that drives real SvelteKit server flows through Playwright using minimal frontend demo surfaces instead of production-grade UI.
- Define how demo routes expose backend journeys in a stable, low-friction way for auth, content, and moderation-oriented workflows without turning demos into a second application.
- Add deterministic backend e2e fixtures and reset expectations so journeys can run repeatedly in local development and CI.
- Establish the first thin slice of user-perspective journeys to prove the pattern and create a base for broader backend coverage later.

## Capabilities

### New Capabilities
- `backend-e2e-user-journeys`: Minimal frontend demo surfaces and deterministic end-to-end backend journeys that validate real user flows against the running SvelteKit application.

### Modified Capabilities

## Impact

- Affected code: `apps/web/src/routes/demo/**`, Playwright e2e coverage, shared test fixtures/utilities, and backend setup paths needed to seed or reset deterministic journey state.
- Affected systems: SvelteKit server runtime, Better Auth-backed session flows, artwork and moderation backend boundaries exercised through demo pages, and CI/local quality gates that run end-to-end coverage.
- Dependencies: existing backend capabilities remain the source of truth for business behavior; this change adds a user-journey validation layer on top of them rather than redefining domain semantics.
- Follow-on work unlocked: expanding journey coverage across additional backend slices without re-deciding the demo/test harness each time.