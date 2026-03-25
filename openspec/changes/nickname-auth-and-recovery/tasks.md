## 1. Auth and identity schema foundation

- [ ] 1.1 Generate the Better Auth schema so `apps/web/src/lib/server/db/auth.schema.ts` reflects the actual auth tables used by the app
- [ ] 1.2 Replace the demo `task` schema with product identity tables and enums needed for canonical users, nickname uniqueness, recovery hashes, and role persistence
- [ ] 1.3 Add durable persistence for auth abuse protection windows and counters used by failed login and failed recovery limits
- [ ] 1.4 Generate and review the Drizzle migration set for the identity, role, and auth-abuse schema changes

## 2. Server-side auth domain boundaries

- [ ] 2.1 Reconfigure Better Auth usage so signup, login, and recovery flows can operate from normalized nickname-based identity instead of email-first assumptions
- [ ] 2.2 Implement server-side validation and normalization helpers for nickname, password, and recovery-key inputs
- [ ] 2.3 Implement signup orchestration that creates the auth record, companion product user record, default `user` role, session, and one-time recovery key
- [ ] 2.4 Implement nickname availability lookup using the same normalization and uniqueness rules as signup
- [ ] 2.5 Implement nickname-based login and logout flows without leaking whether nickname or password caused a failure
- [ ] 2.6 Implement recovery-key password reset with hash verification, password replacement, recovery-key rotation, and one-time return of the new raw key

## 3. Canonical request identity and authorization foundations

- [ ] 3.1 Enrich request-local auth resolution so server code receives a canonical authenticated product identity instead of only the raw Better Auth user/session objects
- [ ] 3.2 Define integrity handling for valid auth sessions that are missing a companion product user record
- [ ] 3.3 Expose persisted role information through the canonical authenticated identity for future RBAC checks while keeping moderator/admin workflows out of scope

## 4. Auth abuse protection

- [ ] 4.1 Implement durable failed-login rate limiting against the configured actor and time window
- [ ] 4.2 Implement durable failed-recovery rate limiting against the configured actor and time window
- [ ] 4.3 Ensure auth abuse protection survives app restarts and does not rely on in-memory counters
- [ ] 4.4 Return safe auth-limit responses that do not reveal sensitive account-state details

## 5. Verification and test coverage

- [ ] 5.1 Add integration tests for nickname signup, duplicate nickname rejection, invalid nickname rejection, and one-time recovery key issuance
- [ ] 5.2 Add integration tests for nickname availability outcomes across available, unavailable, and invalid nickname inputs
- [ ] 5.3 Add integration tests for nickname login, logout, and non-enumerating auth failures
- [ ] 5.4 Add integration tests for canonical authenticated identity resolution and missing companion-user integrity failures
- [ ] 5.5 Add integration tests for successful recovery, invalid recovery key rejection, and old recovery key invalidation after rotation
- [ ] 5.6 Add integration tests for durable auth abuse protection across repeated failures and process restarts where practical
