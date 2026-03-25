## Why

The current codebase only has a minimal Better Auth setup with email-and-password enabled, while the PRD defines nickname-first identity, recovery-key resets, basic roles, and abuse limits as core backend behavior. This change establishes the first real product-grade backend slice so later capabilities like publishing, voting, comments, and moderation can build on a stable identity and access model.

## What Changes

- Replace the current email-first auth posture with nickname-first account flows aligned to the PRD.
- Introduce product-level identity data and persistence needed for unique nicknames, recovery-key rotation, and role assignment.
- Define authenticated session resolution for SvelteKit server boundaries so later backend slices can rely on a canonical current-user model.
- Add recovery-key based password reset behavior, including one-time regeneration of the recovery key after successful recovery.
- Add baseline abuse protections for auth-sensitive flows such as failed login attempts and recovery attempts.
- Establish automated integration coverage for signup, login, logout, session lookup, and recovery flows as the first backend behavior locked down by tests.

## Capabilities

### New Capabilities
- `identity-and-access`: Nickname-based signup and login, recovery-key account recovery, session resolution, role foundations, and auth abuse protection for the application backend.

### Modified Capabilities
- None.

## Impact

- Affected code: `apps/web/src/lib/server/auth.ts`, `apps/web/src/lib/server/db/schema.ts`, `apps/web/src/lib/server/db/auth.schema.ts`, `apps/web/src/hooks.server.ts`, auth-related route handlers, validation schemas, and backend integration tests.
- Affected systems: Better Auth configuration, PostgreSQL/Drizzle schema and migrations, session cookies, and environment setup for auth secrets and origin configuration.
- Dependencies: Better Auth remains the auth engine, but it must be extended to support nickname-first UX and recovery-key flows defined in `docs/PRD.md`.
- Follow-on work unlocked: artwork publishing, comments, votes, moderation permissions, and any server-side capability that depends on authenticated user identity.
