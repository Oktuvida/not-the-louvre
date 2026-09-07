## Context

The repository already has the essential ingredients for backend end-to-end coverage: Playwright is wired into the app package, `/demo` routes already exist, and backend business behavior is mostly validated through server-level tests. What is missing is a deliberate pattern for exercising that backend through real browser-driven user journeys without waiting for the production UI to mature.

This change should stay incremental. The demos are not a second frontend product; they are thin, stable test surfaces that let Playwright drive real auth cookies, form submissions, file uploads, redirects, and read models against the running SvelteKit app. The first slice needs to be narrow enough to land quickly while still proving that the pattern is worth expanding.

## Goals / Non-Goals

**Goals:**
- Establish a repeatable backend e2e pattern based on minimal `/demo` routes plus Playwright journeys.
- Keep journey state deterministic so tests can run repeatedly in local development and CI.
- Cover the first meaningful user flows through the real app runtime, starting with authentication and one authenticated artwork flow.
- Keep selectors, responses, and reset behavior stable enough that backend contracts can evolve from user journeys rather than only internal tests.

**Non-Goals:**
- Building polished production UI for these journeys.
- Replacing the existing unit, route, or integration tests.
- Achieving full backend e2e coverage for every MVP capability in one change.
- Introducing external test orchestration services or a second app dedicated to test harnessing.

## Decisions

### 1. Use purpose-built `/demo` routes as the browser contract

Playwright journeys will target minimal routes under `/demo` rather than the future production experience. Each demo page will expose only the fields, actions, and server-rendered results needed to drive a backend contract from a user perspective.

Why this decision:
- The backend can gain user-journey coverage immediately, even while production UI is still evolving.
- Minimal demos reduce selector churn and keep tests focused on backend behavior rather than styling.
- The project already uses this pattern for auth and a simple Playwright smoke route, so the change extends an existing direction instead of inventing a new harness.

Alternatives considered:
- Wait for product UI before adding e2e coverage: rejected because it delays backend validation behind unrelated frontend work.
- Drive routes through raw HTTP request tests only: rejected because it misses real cookie, navigation, redirect, and browser form behavior.

### 2. Keep deterministic state through guarded test fixtures and reset entry points

The app will provide deterministic e2e state setup for Playwright runs, including seeded users or cleanup/reset hooks guarded by the Playwright runtime flag. Tests need a reliable way to begin from known state without leaking test-only controls into normal runtime behavior.

Why this decision:
- Browser journeys are only trustworthy if they start from known database and auth conditions.
- Guarding the setup path behind `PLAYWRIGHT=1` fits the existing auth configuration and limits accidental exposure.
- A shared setup/reset layer prevents each test from inventing its own seeding logic.

Alternatives considered:
- Let each test build all state through the UI alone: rejected because it is slower, duplicates setup steps, and makes later journeys brittle.
- Reset state out-of-band with ad hoc manual scripts: rejected because it is less reproducible and harder to run in CI.

### 3. The first thin slice covers auth plus one artwork journey end to end

The initial implementation will keep the existing nickname-auth demo as a foundation and add one authenticated artwork-focused demo journey that exercises a real server write and subsequent read/interaction surface. This proves the pattern across anonymous entry, authenticated session handling, and domain behavior without trying to span all backend capabilities at once.

Why this decision:
- Authentication is already partially represented in the demo area, so it is the lowest-friction starting point.
- Adding one artwork journey proves that the pattern extends beyond auth into core product behavior.
- A narrow first slice leaves room to harden the harness before copying it into moderation, reporting, or admin flows.

Alternatives considered:
- Cover only auth in this change: rejected because it would not prove cross-domain usefulness.
- Cover every major backend slice immediately: rejected because the first harness would grow too large before the pattern stabilizes.

### 4. Demo pages stay intentionally plain but semantically stable

Demo pages will prefer accessible labels, simple forms, explicit result text, and a small amount of stable machine-readable structure where needed. The goal is for backend outcomes to be visible in the page without coupling tests to visual polish or layout details.

Why this decision:
- It keeps e2e assertions readable and resilient.
- It avoids turning demo pages into a bespoke component system.
- It keeps the focus on backend outcomes that matter to users: success, failure, persisted state, and authorization boundaries.

Alternatives considered:
- Use only opaque `data-testid` markers: rejected because demos should remain understandable to humans during debugging.
- Mirror full product component patterns: rejected because it adds unnecessary frontend maintenance cost.

## Risks / Trade-offs

- Test-only setup surfaces could leak into non-test runtime behavior. -> Mitigation: gate them behind `PLAYWRIGHT=1`, keep them under demo/test boundaries, and avoid enabling them in normal environments.
- Demo routes may drift away from real backend usage if they become too synthetic. -> Mitigation: keep demos thin, form-driven, and wired to the same server actions or endpoints that product code uses.
- Stateful browser journeys can become slow or flaky as coverage grows. -> Mitigation: centralize deterministic setup, keep the first slice narrow, and reserve broad matrix coverage for lower-level tests.
- Artwork e2e coverage that depends on media upload can be cumbersome. -> Mitigation: use a committed deterministic fixture asset and keep the artwork journey scoped to one well-defined happy-path flow plus critical visible failure states where practical.

## Migration Plan

1. Formalize the new capability spec for backend e2e user journeys.
2. Add shared Playwright-oriented setup/reset utilities guarded for test runtime only.
3. Expand `/demo` with stable minimal surfaces for the first artwork journey while preserving or refining the existing auth demo.
4. Add Playwright journeys for auth and the first artwork flow against the running SvelteKit app.
5. Run the standard quality gates and adjust any fragile setup before expanding the pattern further.

Rollback:
- Remove the new demo surfaces, test-only setup hooks, and Playwright journeys while leaving existing lower-level backend tests intact.
- Because this change adds validation infrastructure more than production behavior, rollback is mostly isolated to the demo/test layer.

## Open Questions

- Whether the first artwork journey should stop at publish-and-readback or also include one authenticated interaction such as voting or commenting in the same slice.
- Whether deterministic state reset should be exposed through a dedicated guarded route, server action, or Playwright global setup helper that talks directly to app-local utilities.