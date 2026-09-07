## Why

The current product frontend still relies on an animated mock auth overlay, while the backend auth flow is already real, tested, and exposed through stable SvelteKit actions. We need to replace the mock contract now so the app can establish a real signed-in and signed-out state, unblock the rest of the UI wiring, and stop duplicating auth behavior in the frontend.

## What Changes

- Replace the mocked frontend auth overlay behavior with real wiring to the existing nickname-based auth backend flow.
- Define the page, state, and transition contract for sign up, sign in, sign out, nickname availability, and account recovery using the existing SvelteKit server actions.
- Establish how the frontend handles auth bootstrapping, redirect gating, pending states, success redirects, backend validation failures, abuse-limit errors, and integrity failures.
- Document the first implementation slice so the real auth flow becomes the reference pattern for wiring later product surfaces to backend state.

## Capabilities

### New Capabilities
- `frontend-auth-flow`: Product-facing authentication experience that wires the real frontend auth entry and session views to the existing backend auth contract.

### Modified Capabilities
- `identity-and-access`: Extend the existing auth requirements so product UI entry, session bootstrapping, and failure-state handling are defined as part of the supported auth behavior.

## Impact

- Affected code: auth-related frontend routes, layouts, overlay or modal state, client auth presentation components, and the existing auth demo patterns used as reference.
- Affected backend boundaries: `apps/web/src/hooks.server.ts`, `apps/web/src/routes/demo/better-auth/**` patterns, and auth services already backed by Better Auth.
- Affected systems: session-aware routing, signed-in bootstrapping, error handling, and automated coverage for auth user journeys.
- Dependencies: existing backend auth services, canonical `event.locals.user` resolution, and form-action based same-origin mutation flow remain the source of truth.
