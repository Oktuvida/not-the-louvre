## Context

The backend already implements the main MVP product slices: identity, media-backed publishing, discovery, social interactions, lineage, moderation, and constrained realtime. What remains from the PRD is not a large new domain behavior but launch hardening: the application server needs a clearly defined posture for expired sessions, unsafe state-changing requests, and security-relevant operational signals.

The current backend shape is favorable for a medium-sized hardening slice. Most mutations already flow through SvelteKit routes and shared services, and authenticated identity resolution is centralized in `resolveSessionContext` and `hooks.server.ts`. That means request hardening and operational security behavior can be applied near the server boundary instead of re-implementing ad hoc checks across every route.

## Goals / Non-Goals

**Goals:**
- Define consistent server-side handling for expired or invalid sessions during request identity resolution.
- Enforce a backend-origin safety policy for state-changing requests that rely on cookie-backed authenticated sessions.
- Introduce minimal structured logging for security-relevant failures and denials so production debugging and review are possible without a separate telemetry platform.
- Add automated validation for session-expiry handling, unsafe mutation rejection, and critical auth/integrity failure behavior.
- Keep the design vendor-neutral and application-scoped.

**Non-Goals:**
- Adding a third-party observability platform, tracing backend, or full metrics stack.
- Building a complete security framework for every future endpoint or a formal SOC-style audit system.
- Redesigning Better Auth internals or replacing cookie-based sessions.
- Reworking frontend UX around login, logout, or error messaging beyond what backend hardening requires.

## Decisions

### 1. Centralize hardening at the request boundary instead of per-route policy sprawl

Request hardening will be applied through shared server-boundary logic in the request pipeline and small reusable guards for route handlers. The backend already routes product writes through SvelteKit, so the most reliable way to harden behavior is to make unsafe or malformed requests fail before they reach domain services.

Why this decision:
- It keeps security behavior consistent across artwork, moderation, admin, and auth-adjacent mutations.
- It reduces the chance that future routes forget to implement the same checks.
- It matches the existing architecture where canonical identity is already resolved in one place.

Alternatives considered:
- Add origin and session checks inside every route handler: rejected because it invites drift and incomplete coverage.
- Push hardening entirely into domain services: rejected because request-level concerns such as origin and method safety belong at the boundary, not inside product logic.

### 2. Expired or invalid sessions resolve as unauthenticated; integrity failures remain distinct

If a request presents an expired or otherwise invalid session, the backend will treat it as unauthenticated and will not expose authenticated product identity to route or service code. By contrast, a valid auth session with a missing companion product user remains an integrity failure because it signals corrupted application state rather than a normal anonymous request.

Why this decision:
- It keeps authorization logic simple for product code: authenticated identity is either valid or absent.
- It preserves the existing distinction between user-facing auth expiry and backend data corruption.
- It creates a clean testable contract around session resolution.

Alternatives considered:
- Surface expired sessions as integrity failures: rejected because expiry is a normal auth lifecycle event, not a data corruption condition.
- Expose partial auth session data even when the product identity is unavailable: rejected because it weakens downstream authorization assumptions.

### 3. Cookie-backed state-changing requests require trusted same-origin intent

The backend will enforce an origin/referrer-based safety check for state-changing requests that rely on cookie-backed session authority. Safe methods remain unaffected; unsafe cross-site mutation attempts are rejected before product code runs.

Why this decision:
- The MVP uses secure httpOnly cookies, so CSRF-style request hardening belongs in the backend request layer.
- It protects authenticated mutation routes without requiring a larger token-based redesign.
- It stays aligned with the PRD trust boundary where authority is server-derived, not client-asserted.

Alternatives considered:
- Add synchronizer CSRF tokens immediately: rejected for this slice because same-origin enforcement is smaller, easier to roll out consistently, and sufficient for the current architecture.
- Rely on cookie attributes alone: rejected because cookie posture helps but does not fully define request-origin policy at the application boundary.

### 4. Operational visibility stays minimal and structured

The backend will log a narrow set of security-relevant events in a structured way: integrity failures, unsafe mutation rejections, and auth-abuse limit denials. The goal is actionable diagnostics and reviewability, not a new observability product.

Why this decision:
- It gives launch-ready operational visibility for the highest-signal failure modes.
- It avoids coupling the project to a logging vendor or heavyweight telemetry stack.
- It keeps the slice medium-sized and realistic to implement quickly.

Alternatives considered:
- Introduce tracing, metrics, and external alerting now: rejected because it is too broad for the next backend slice.
- Do no logging beyond framework defaults: rejected because security-relevant failures become hard to diagnose in production.

## Risks / Trade-offs

- Overly strict origin checks could break legitimate local or proxy-based workflows. -> Mitigation: define trusted-origin behavior against existing `ORIGIN` configuration and cover local development paths in tests.
- Minimal structured logging can still miss future operational needs. -> Mitigation: scope the schema to high-signal events that can later be forwarded to richer infrastructure without redesigning call sites.
- Central request guards may accidentally affect auth or webhook-like paths that need exceptions. -> Mitigation: explicitly document guarded route categories and keep exemptions narrow and test-covered.
- Distinguishing expired sessions from integrity failures depends on auth-library behavior. -> Mitigation: lock the contract with tests around `resolveSessionContext` and request-local state exposure.

## Migration Plan

1. Add automated tests that capture expired-session handling, unsafe origin rejection, and structured logging for critical denials.
2. Introduce shared request-hardening utilities and integrate them into the server request pipeline and authenticated mutation routes.
3. Update session-resolution behavior so expired or invalid auth sessions do not surface partial product identity.
4. Add structured logging for integrity failures, auth abuse throttling, and blocked unsafe state-changing requests.
5. Run the standard quality gates and verify no existing authenticated workflows regress under the stricter request boundary.

Rollback:
- Revert the request-boundary guard integration and logging changes first while preserving domain services.
- Because this slice is primarily boundary hardening, rollback is straightforward if any environment-specific origin rules need to be relaxed.

## Open Questions

- Whether the hardening slice should cover all non-GET product routes immediately or first target authenticated `/api` mutations only, with auth library endpoints evaluated separately.
- Whether the structured log payload should include a stable event code taxonomy in this slice or rely on message-plus-context fields initially.