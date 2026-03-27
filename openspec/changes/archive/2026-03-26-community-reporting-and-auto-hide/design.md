## Context

The backend now covers the main content loop from the PRD: identity, publishing, discovery, community interactions, fork lineage, and ranked feeds. What it still lacks is governance. Users can create, boost, and spread content, but there is no backend-owned way for the community to report problematic content, no threshold that can automatically hide it from public views, and no bounded moderator action surface to intervene.

This change should stay intentionally narrower than the full moderation phase described in the PRD. The goal is not to build a complete internal moderation product. The goal is to establish report persistence, auto-hide behavior, visibility semantics, and core moderator actions so the content system can be governed at the backend level before the project grows more socially and operationally complex.

## Goals / Non-Goals

**Goals:**
- Add backend support for authenticated users to report artworks and comments.
- Persist report records with structured target and reason information.
- Define configurable auto-hide threshold behavior for reported content.
- Introduce backend visibility semantics for hidden artworks and comments across public, author, and moderator contexts.
- Add bounded moderator actions to hide, unhide, and delete reported content.
- Enforce moderator authorization for moderation actions.
- Lock the behavior down with automated tests for reporting, visibility filtering, and review actions.

**Non-Goals:**
- Full moderator dashboard or queue UX.
- Client-side NSFWJS publish gating.
- Notification or warning systems for moderated users.
- Sophisticated abuse heuristics, trust scores, or reputation systems.
- Full audit log or appeal workflow.
- Admin role-management workflows beyond using the existing role foundation.

## Decisions

### 1. Treat reporting as its own backend capability instead of folding it into comments or discovery

Reporting crosses multiple domains: artworks, comments, visibility state, and moderator authority. It should therefore be modeled as a distinct capability with its own persistence and action semantics rather than as a minor extension of comments or discovery.

**Alternative considered:** attach simple `reportCount` fields directly to artworks/comments and skip explicit report records. Rejected because moderation decisions need durable target-level evidence, reporter identity, reason data, and future reviewability.

### 2. Auto-hide should transition content visibility, not immediately delete content

The PRD explicitly wants reported content hidden pending moderator review, not destroyed immediately. This change should therefore model threshold-triggered hiding as a visibility transition (`is_hidden`-style backend state) rather than permanent deletion. Deletion remains a distinct moderator action.

**Alternative considered:** delete content automatically once a report threshold is reached. Rejected because it is too destructive for a community signal that may include false positives.

### 3. Visibility semantics should differ by audience

The backend should not treat hidden content as simply nonexistent for everyone. Public discovery/detail reads should exclude hidden content, but authors and moderators need more nuanced access. Authors should still be able to resolve their hidden content in a constrained way, and moderators should be able to review it fully.

**Alternative considered:** hidden content becomes hard-not-found for all requesters. Rejected because the PRD expects hidden content to remain visible to its author with a hidden notice and available to moderators for review.

### 4. Scope moderator actions to hide, unhide, and delete only

To keep the slice medium-sized, moderator actions should be limited to the core visibility lifecycle: hide, unhide, and delete. Queue sorting, warnings, dashboards, and richer workflow states can build on that later.

**Alternative considered:** include pending/reviewed/actioned workflow orchestration and full queue management now. Rejected because it pushes the change toward a large operations product rather than a bounded backend capability.

### 5. Auto-hide thresholds should be configurable and target-type agnostic

Artworks and comments both need reporting, and the threshold may need tuning after real usage. The backend contract should therefore define threshold behavior while allowing configuration values to evolve without changing the public API. The same basic threshold posture should work for both artworks and comments.

**Alternative considered:** hardcode a single magic number separately in each implementation path. Rejected because threshold tuning is likely and duplicated constants invite drift.

### 6. Ranked and discovery reads should consume visibility state as a first-class filter

Now that ranked feeds exist, moderation cannot be treated as an isolated side channel. Hidden content must be excluded consistently from `Recent`, `Hot`, `Top`, and artwork detail reads in public contexts. That means visibility state belongs in the read path as a first-class backend concern.

**Alternative considered:** apply hiding only in moderator-specific endpoints and leave main discovery untouched. Rejected because it would fail the core safety goal and let ranked feeds continue surfacing content that has already crossed a moderation threshold.

## Risks / Trade-offs

- **False positives can hide acceptable content** -> Mitigation: make auto-hide reversible through moderator unhide and keep thresholds configurable.
- **Visibility semantics can sprawl across many read paths** -> Mitigation: centralize hidden-content filtering rules in read-model services instead of scattering them ad hoc.
- **Moderation scope can grow uncontrollably** -> Mitigation: keep this slice focused on reports, auto-hide, and the minimal moderator action set only.
- **Role-based moderation behavior depends on existing RBAC foundations staying clean** -> Mitigation: reuse the canonical authenticated identity and current role model rather than introducing a parallel permission system.

## Migration Plan

1. Add persistence structures for reports and hidden-content state needed by artworks/comments.
2. Add report submission behavior for authenticated users with structured target validation.
3. Implement threshold-triggered hide behavior and integrate visibility filtering into public discovery/detail/comment reads.
4. Add moderator actions for hide, unhide, and delete over reported content.
5. Add automated tests for threshold transitions, visibility semantics, and moderator authorization flows.

**Rollback:**
- Remove report submission and moderator action endpoints, revert hidden-content read filtering, and back out schema additions. Because this slice is additive around governance rather than core content creation, rollback is manageable if downstream UI work has not yet deeply coupled to moderated states.

## Open Questions

- Should authors be able to read the full hidden-content detail payload, or should they receive a reduced “your content is hidden” representation while moderators see the full record?
- Should auto-hide thresholds be identical for artworks and comments in the first version, or should the implementation allow distinct thresholds from day one without exposing that complexity publicly?
