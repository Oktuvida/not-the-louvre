## 1. Session resolution hardening

- [ ] 1.1 Add failing tests for `resolveSessionContext` and request-local state showing that expired or invalid auth sessions do not expose authenticated product identity.
- [ ] 1.2 Update session resolution and `hooks.server.ts` handling so expired or invalid sessions are treated as unauthenticated while valid session/product-user mismatches remain integrity failures.
- [ ] 1.3 Add regression coverage for downstream route behavior to ensure authenticated endpoints still reject requests correctly when session state is absent after expiry handling.

## 2. Request boundary protection

- [ ] 2.1 Add failing route or integration tests for unsafe cross-site state-changing requests against cookie-backed mutation endpoints.
- [ ] 2.2 Implement a shared trusted-origin guard for state-changing backend requests and apply it to the appropriate product mutation boundary.
- [ ] 2.3 Add compatibility coverage for trusted local and configured-origin requests so legitimate authenticated workflows continue to pass.

## 3. Security-relevant operational signals

- [ ] 3.1 Add failing tests for structured logging of auth integrity failures, blocked unsafe mutation requests, and auth abuse-limit denials.
- [ ] 3.2 Introduce minimal structured logging utilities or conventions for these security-relevant backend events without adding external telemetry dependencies.
- [ ] 3.3 Wire the logging behavior into the auth/session pipeline and request-hardening path while avoiding secret leakage in log payloads.

## 4. Quality validation

- [ ] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, `bun run test:unit`, and `bun run test:e2e` and resolve any failures related to the hardening change.