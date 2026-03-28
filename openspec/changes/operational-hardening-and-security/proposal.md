## Why

The backend now covers most MVP domain behavior, but the PRD still leaves operational hardening and security review as explicit backend work before launch. This is the right next slice because the product already has authenticated mutation routes, realtime exposure, and moderation flows, yet it still lacks a clearly specified backend posture for expired-session handling, request hardening, and operational security signals.

## What Changes

- Define backend security requirements for authenticated mutation requests, including request-origin hardening and consistent rejection of unsafe cross-site or malformed state-changing calls.
- Add explicit backend semantics for expired or otherwise invalid authenticated sessions so product code never receives a stale or partial canonical identity.
- Introduce minimal operational hardening requirements for backend logging and security-relevant event visibility, focused on actionable application signals rather than full observability infrastructure.
- Add automated backend validation for security headers, request hardening behavior, session-expiry handling, and critical auth/integrity failure paths.
- Keep the slice vendor-neutral and application-scoped, without adding external telemetry platforms or a full infrastructure monitoring stack.

## Capabilities

### New Capabilities
- `operational-hardening`: Backend application hardening requirements covering request security posture, security-relevant structured logging, and operational validation for launch readiness.

### Modified Capabilities
- `identity-and-access`: Session resolution requirements expand to cover expired-session handling, integrity-failure boundaries, and safer server-side treatment of authenticated request state.

## Impact

- Affected code: `apps/web/src/hooks.server.ts`, auth/session resolution services, authenticated route handlers, shared request-validation utilities, backend tests, and environment documentation where new hardening expectations need to be documented.
- Affected systems: Better Auth session handling, SvelteKit server request pipeline, cookie-backed authenticated mutations, route-level security posture, and application logging for auth and integrity failures.
- Dependencies: `identity-and-access` for canonical user resolution, existing authenticated artwork/admin/moderation endpoints for request hardening rollout, and the current MVP trust boundary that keeps writes on SvelteKit server routes.
- Follow-on work unlocked: deeper security review, production monitoring integration, alerting, and broader operational resilience work built on a stable application-level hardening baseline.