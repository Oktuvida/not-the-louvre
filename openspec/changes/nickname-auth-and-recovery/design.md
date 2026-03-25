## Context

The repository currently has only a minimal Better Auth setup with `emailAndPassword` enabled, placeholder generated auth schema output, and a demo domain schema. The PRD, however, treats identity and access as the first meaningful backend slice: users authenticate with a unique nickname, recover accounts with a one-time recovery key, and later backend capabilities depend on a canonical notion of the current user and their role.

This change is cross-cutting because it touches auth configuration, database design, server request context, validation rules, and abuse protection. It also resolves an architectural ambiguity early: Better Auth should remain the session and credential engine, while product-specific identity rules live in the application schema.

## Goals / Non-Goals

**Goals:**
- Establish a nickname-first authentication model aligned with the PRD.
- Define a clean boundary between Better Auth-owned auth data and product-owned user identity data.
- Provide a canonical authenticated user shape in SvelteKit server code for future backend slices.
- Support recovery-key password reset with single-use rotation semantics.
- Add rate limiting for login and recovery flows without introducing non-essential infrastructure.
- Keep the design small enough to be the first real backend slice, but durable enough to support later capabilities.

**Non-Goals:**
- Artwork publishing, avatar creation, feed reads, votes, comments, or moderation workflows.
- Social or email-based auth, magic links, or OAuth providers.
- A public API contract or separate auth microservice.
- Full production observability and advanced fraud detection.
- Complete RLS coverage for the entire product domain.

## Decisions

### 1. Keep Better Auth as the credential and session engine, but move product identity into an application `users` table

The system will use Better Auth for password storage, session lifecycle, and cookie handling. Product identity concerns such as nickname uniqueness, role, avatar reference, and recovery-key hash will live in the application schema.

This avoids fighting Better Auth for credential internals while also avoiding the opposite mistake of forcing product rules into generated auth tables. The resulting split looks like this:

```text
Better Auth tables         Application tables
-------------------        ------------------
auth user                 users
auth session              - id
auth account              - auth_user_id
                          - nickname
                          - recovery_hash
                          - role
                          - avatar_url
```

**Why this over the alternatives:**
- **Over fully custom auth:** Better Auth already solves sessions and password plumbing well enough for MVP.
- **Over storing everything in generated auth tables:** generated schema ownership becomes muddy and product evolution gets harder.
- **Trade-off accepted:** two user concepts exist, but they have clear responsibilities and a stable join boundary.

### 2. Treat the application `users` row as the canonical product identity record

Server-side product code should depend on the application `users` row, not directly on Better Auth's raw user object. `hooks.server.ts` should continue to resolve the Better Auth session, then enrich request-local auth state with the product user row.

The canonical request-local shape should expose at least:
- auth user id
- product user id
- nickname
- role
- session id / session metadata as needed

This gives future backend slices one stable access model for authorization, ownership checks, and content attribution.

**Alternative considered:** use Better Auth's generated `user` shape directly in `event.locals`. Rejected because later capabilities need nickname, role, and product policy semantics that should not depend on auth-library-specific internals.

### 3. Normalize nicknames to lowercase at the boundary and enforce uniqueness in the database

Nickname input should be normalized to lowercase before validation, persistence, and lookup. The allowed format remains the PRD rule: 3-20 characters, alphanumeric plus underscore.

This means login is case-insensitive from the user's perspective, while storage remains canonical and simple.

**Alternative considered:** preserve display case while comparing case-insensitively. Rejected for MVP because it adds ambiguity and does not materially improve the product.

### 4. Recovery keys belong to the product domain and are stored only as hashes

Recovery keys are not ordinary credentials for ongoing authentication; they are product-level recovery artifacts. They should be generated as UUID v4 values, shown once to the user, hashed before persistence, and rotated after every successful recovery.

The recovery flow should:
- locate the product user by normalized nickname
- verify the submitted recovery key against the stored hash
- update the Better Auth password credential
- generate and persist a new recovery key hash
- return the new raw recovery key once so the UI can show it

**Alternative considered:** store recovery secrets inside Better Auth internals or as plaintext. Rejected because recovery behavior is product-specific and plaintext storage is unacceptable.

### 5. Abuse protection should be Postgres-backed rather than memory-backed

Rate limiting for failed login and recovery attempts should be backed by the application's database, not in-memory counters. A small auth-attempt tracking table or equivalent persistence model is acceptable for MVP.

This choice matches the repo's reproducibility and self-hosting goals: it works across restarts and multi-instance deployments without introducing Redis or another external dependency in the first backend slice.

**Alternative considered:** in-memory rate limits in the app server. Rejected because they break under restarts, are weak in distributed deployments, and make tests less deterministic.

### 6. This change should establish route/service boundaries, not a separate public contract layer

The backend remains an internal SvelteKit application backend. Validation schemas should exist at server boundaries for signup, login, and recovery inputs/outputs, but there is no need for a separate contract-first API initiative.

This follows the PRD's backend guidance: schema + runtime validation + integration tests act as the alignment mechanism.

## Risks / Trade-offs

- **Dual user records can drift** -> Mitigate by creating the application `users` row as part of signup flow orchestration and treating it as a required companion record for authenticated product access.
- **Better Auth may not map cleanly to nickname-first UX out of the box** -> Mitigate by designing the nickname lookup and credential handoff explicitly in server actions/endpoints rather than assuming default email-first handlers.
- **Database-backed rate limiting adds schema complexity early** -> Mitigate by keeping the model narrow to auth-sensitive flows only and avoiding a generic platform-wide rate-limiting system in this change.
- **Recovery flows are security-sensitive** -> Mitigate by hashing recovery keys, rotating on success, returning raw keys only once, and avoiding distinguishable error responses that leak account state.
- **PRD data model currently implies password hash in `users`** -> Mitigate by treating this design as the architectural clarification: passwords stay in Better Auth-owned tables, while product `users` owns recovery and profile data.

## Migration Plan

1. Generate the Better Auth schema so the repository has concrete auth tables under source control expectations.
2. Introduce application identity tables and constraints through Drizzle schema updates and generated migrations.
3. Add signup, login, logout, session-resolution, and recovery server flows with runtime validation.
4. Update request-local auth resolution so product code sees the canonical current-user shape.
5. Add integration tests covering the full auth lifecycle and abuse-limit behavior.
6. Roll out this change before any backend slice that depends on ownership, attribution, or role checks.

**Rollback:**
- Before production data exists, rollback is straightforward: revert the change and migration set.
- After real accounts exist, rollback should preserve account data and is no longer a simple schema reversal; in practice this change should be treated as foundational and forward-only once adopted.

## Open Questions

- Should auth abuse protection count only failed attempts, or should successful recovery/login also participate in cooldown windows for simpler enforcement?

Resolved scope notes:
- Nickname availability checking is included in this first capability because it is part of the onboarding contract and depends on the same normalization and uniqueness rules as signup.
- Moderator/admin management flows are deferred to a later governance-focused spec, but role and RBAC foundations remain part of this change so later capabilities can authorize against stable role data.
