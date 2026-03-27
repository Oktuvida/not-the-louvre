## Why

Vote and comment flows are implemented, but the product still does not satisfy the PRD requirement for live updates on artwork detail views. At the same time, derived counters and report-threshold auto-hide behavior currently depend on application-layer updates, which is serviceable for one writer path but too weak for secure realtime exposure and future concurrency.

## What Changes

- Add backend capability for secure realtime delivery of artwork vote and comment updates scoped to a single artwork detail view.
- Define the minimal realtime-facing data model, row-level security policies, and grants required so clients can subscribe without exposing broader backend state.
- Harden derived artwork counters so `score`, `commentCount`, and `forkCount` remain canonical under concurrent mutations and do not depend solely on application-layer maintenance.
- Strengthen report-threshold auto-hide behavior so hidden-state transitions remain consistent under concurrent report submissions.
- Add backend validation coverage for realtime-safe exposure and database-level consistency guarantees.

## Capabilities

### New Capabilities
- `artwork-realtime`: Live vote and comment update delivery for artwork detail views using secure, least-privilege realtime exposure.
- `artwork-derived-counters`: Canonical database-backed maintenance of derived artwork counters and related consistency guarantees.

### Modified Capabilities
- `community-reporting`: Tighten auto-hide requirements so threshold-based hidden-state transitions remain correct under concurrent reporting.

## Impact

- Affected code: `apps/web/src/lib/server/artwork/repository.ts`, `apps/web/src/lib/server/artwork/read.repository.ts`, `apps/web/src/lib/server/db/schema.ts`, new migrations under `apps/web/drizzle`, and server tests around votes, comments, reports, and reads.
- Affected systems: PostgreSQL schema objects, trigger/functions or equivalent DB-level invariants, Supabase Realtime publication/policies, and backend integration tests.
- API/runtime impact: artwork detail clients gain realtime subscription support for votes/comments; public backend write paths remain on SvelteKit server boundaries.
- Dependencies: Supabase Realtime configuration and Postgres RLS/policy support become part of the backend contract for social interactions.