## Context

The backend already supports artwork publishing, discovery, votes, comments, reporting, moderation, and role-aware reads. However, live social updates are still missing, and the current denormalized counters are maintained inside application repositories rather than owned by database invariants. That is acceptable while every mutation goes through one service path, but it is a weak foundation for Supabase Realtime exposure, concurrent moderation/report flows, and future operational hardening.

This change must preserve the current trust boundary from the PRD: writes and sensitive reads stay on SvelteKit server routes, while frontend-to-Supabase access is limited to the smallest realtime surface needed for artwork detail vote and comment updates. The design also needs to avoid broadening the public data contract beyond what the detail view already needs.

## Goals / Non-Goals

**Goals:**
- Deliver live vote and comment updates for a single artwork detail view.
- Expose only the minimum realtime-facing tables and columns needed for those updates.
- Enforce row-level security and grants before any realtime client exposure.
- Move `score`, `commentCount`, `forkCount`, and report-threshold hidden-state consistency to database-owned guarantees.
- Keep existing server write boundaries and existing read contracts stable wherever possible.

**Non-Goals:**
- Realtime feed updates for discovery pages.
- Direct client writes to votes, comments, reports, or artworks.
- Broad Supabase/PostgREST client exposure for backend-only relations.
- Notification delivery, presence, or other collaborative realtime features.

## Decisions

### 1. Realtime remains detail-scoped, not feed-scoped
The system will support realtime only while a client is viewing one artwork detail surface. Vote and comment subscriptions will be filtered by `artwork_id` and used to patch or refresh the local detail projection.

Why this decision:
- It matches the PRD's explicit MVP scope.
- It keeps subscription count and payload volume low.
- It avoids prematurely introducing feed invalidation and ranked-list churn.

Alternatives considered:
- Feed-wide subscriptions: rejected because it adds ranking invalidation and much noisier traffic.
- No realtime, polling only: rejected because it does not close the PRD gap.

### 2. Realtime exposure uses narrow social tables with RLS and least-privilege grants
Realtime exposure will be limited to the vote and comment relations needed for artwork detail updates. Policies will be row-scoped and role-aware, and payloads must not expose moderation-only or identity-sensitive fields.

Why this decision:
- It preserves the current backend trust model.
- It reduces accidental exposure compared with opening broader read models.
- It aligns with the PRD requirement that realtime-facing relations use RLS.

Alternatives considered:
- Realtime on broader artwork/detail projections: rejected because it exposes more columns and complicates policy boundaries.
- Realtime through custom websocket infrastructure: rejected because Supabase Realtime is already part of the product architecture.

### 3. Derived counters become database-owned invariants
`score`, `commentCount`, and `forkCount` will be maintained by database-side logic so they remain canonical under insert, update, delete, hide, unhide, and concurrent mutation flows that affect public projections.

Why this decision:
- Counters must stay correct even if multiple code paths or concurrent transactions mutate the same rows.
- Database ownership creates a single source of truth for read models and realtime refresh logic.
- It removes hidden coupling between repository methods and correctness.

Alternatives considered:
- Keep counters in application repositories: rejected because correctness depends on every writer remembering to maintain counters.
- Recompute counters on every read: rejected because it increases query cost and weakens ranked/discovery performance.

### 4. Auto-hide threshold transitions become atomic and idempotent
The report threshold check and hidden-state transition for artworks and comments will be enforced through database-backed logic that tolerates concurrent reports without double-transition or missed-threshold behavior.

Why this decision:
- The current create-report then count-then-hide flow is vulnerable to race conditions.
- Moderation visibility and public read semantics depend on hidden state being trustworthy.

Alternatives considered:
- Leave auto-hide in service code with stronger transactions only: rejected because it still leaves correctness tied to application sequencing.

### 5. Existing server contracts stay stable; clients react through patch-or-refresh semantics
The current SvelteKit write APIs remain authoritative. Realtime events are an observation layer, not a new mutation channel. Clients may patch counters or refetch detail/comments after receiving subscription events, but they do not gain new write authority.

Why this decision:
- It preserves current auth and validation flows.
- It keeps rollout incremental and reversible.
- It avoids mixing direct realtime writes with server-enforced domain rules.

Alternatives considered:
- Allow direct client writes to exposed tables: rejected because it breaks the established trust boundary.

## Risks / Trade-offs

- Trigger and policy complexity increases migration risk. → Mitigation: keep exposure limited to the smallest table set and cover migrations with integration tests.
- Counter semantics can become ambiguous around hidden content. → Mitigation: explicitly define counters as reflecting active public-visible state for discovery/detail projections.
- Realtime event payloads may still require client-side refetches for correctness after moderation changes. → Mitigation: treat events as invalidation signals when a safe local patch is not possible.
- Supabase Realtime policy mistakes can silently overexpose data. → Mitigation: add explicit policy/grant verification tests and keep payload columns narrow.

## Migration Plan

1. Add schema objects and migrations for database-owned counter maintenance and atomic auto-hide transitions.
2. Add RLS policies and grants for the realtime-facing vote/comment relations before enabling client subscriptions.
3. Update backend tests to validate counter invariants, moderation threshold concurrency semantics, and realtime-safe exposure.
4. Roll out client subscriptions on artwork detail only after the DB contract is in place.
5. Keep rollback simple by preserving existing server routes and disabling subscriptions if needed while reverting DB exposure changes.

## Open Questions

- Whether public `forkCount` should exclude hidden forks as well as deleted forks; this design assumes counters should match public-visible lineage.
- Whether clients should patch local vote/comment state directly from realtime payloads or always refetch after event receipt; both remain compatible with this backend contract.