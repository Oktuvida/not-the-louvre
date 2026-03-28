## Context

The backend already has the main building blocks of moderation: authenticated users can submit reports, the database can auto-hide content when report volume crosses a threshold, moderators can hide, unhide, or delete artworks and comments, and moderators can query a queue of reported targets. What is missing is lifecycle ownership. Reports behave like permanent evidence rows with no distinction between active and resolved cases, so queue membership, threshold counting, and moderator action outcomes are all derived from historical totals rather than the current review state.

This change needs a design because it is cross-cutting across schema, queue aggregation, moderator actions, and threshold semantics. It also touches governance behavior that the PRD already models explicitly through `pending`, `reviewed`, and `actioned` report states.

## Goals / Non-Goals

**Goals:**
- Introduce durable lifecycle state for moderation reports with reviewer attribution.
- Ensure active report counts represent distinct unresolved reporter signals, not repeated submissions.
- Make auto-hide and moderation queue behavior depend on active unresolved reports only.
- Define how moderator decisions resolve associated reports for artwork and comment targets.
- Add a bounded moderator dismissal path for false positives without requiring content mutation.
- Preserve the current backend trust boundary and reuse existing moderation surfaces where practical.

**Non-Goals:**
- Building a moderator dashboard UI or inbox workflow.
- Adding moderator notes, warnings, appeals, or full audit trails.
- Replacing the existing hide, unhide, and delete moderation semantics for content visibility.
- Expanding client-direct Supabase access or changing current RLS scope.

## Decisions

### 1. Reports become lifecycle records, not permanent active votes

Each report row will gain explicit review state so the system can distinguish unresolved signals from already-handled cases. The backend contract will treat `pending` as active, `reviewed` as resolved without content action, and `actioned` as resolved through a moderator action that changes or removes content.

Why this decision:
- It aligns the data model with the PRD rather than keeping report handling implicit.
- It gives queue and threshold logic a canonical definition of “active”.
- It avoids inventing a parallel case table for a slice that is still medium-sized.

Alternatives considered:
- Add a separate moderation case aggregate and leave reports immutable: rejected because it adds another data model layer before the current report model is exhausted.
- Keep reports append-only and infer resolution from content visibility: rejected because false positives and no-action review decisions cannot be represented cleanly.

### 2. Active report uniqueness is enforced at the database layer per reporter and target

The system will allow at most one active report from a given reporter for a given artwork or comment at a time. Once that report is resolved, the same reporter may submit a new report later if new behavior warrants it.

Why this decision:
- Thresholds should reflect distinct unresolved reporters, not repeated clicks from one account.
- Database-level enforcement is more reliable than service-only checks under concurrency.
- It preserves a simple mental model for moderators reviewing counts.

Alternatives considered:
- Service-level deduplication only: rejected because concurrent submissions could still double-insert.
- Permanent uniqueness for all historical reports: rejected because it prevents re-reporting after a legitimate later incident.

### 3. Auto-hide and queue membership are derived from pending reports only

The configured threshold will be computed from reports whose status is still `pending`. Moderation queue reads will likewise aggregate only pending reports and exclude targets whose pending count is zero, even if they have historical resolved reports.

Why this decision:
- It makes queue state match moderator workload instead of historical activity.
- It lets dismissals and resolved actions actually remove a target from active review.
- It keeps threshold semantics stable after moderation resolution.

Alternatives considered:
- Count all historical reports forever: rejected because targets never truly leave review.
- Hard-delete resolved reports: rejected because it destroys useful moderation history too early.

### 4. Moderator resolution is target-scoped and can resolve reports in bulk

Moderator decisions will resolve the active reports associated with the reviewed target in one operation. `hide` and `delete` will mark active reports as `actioned`; `dismiss` and false-positive `unhide` decisions will mark active reports as `reviewed`. Existing artwork/comment moderation actions remain authoritative for content mutation, while a shared moderation-resolution seam coordinates report-state updates.

Why this decision:
- Moderators review targets, not isolated rows one by one, in the current backend shape.
- Bulk resolution keeps queue and target state synchronized.
- It minimizes API sprawl by reusing existing moderation actions and adding only the missing no-action dismissal path.

Alternatives considered:
- Resolve reports one row at a time: rejected because it complicates queue semantics and forces a larger operations workflow.
- Add a brand-new moderation subsystem with separate target and report actions: rejected because it is too large for the intended slice.

### 5. The backend adds one explicit dismissal path without changing public reporting entry points

Report submission endpoints remain the same. Existing moderator hide, unhide, and delete handlers remain the content-action surface. The only new moderation capability introduced at the API level is a bounded dismissal/review action for closing pending reports on a target without mutating the target content.

Why this decision:
- It closes the current false-positive gap with the smallest possible API addition.
- It preserves existing routes and service seams for content mutation.
- It keeps the change medium-sized rather than turning queue review into a new subsystem.

Alternatives considered:
- Overload `unhide` to dismiss pending reports even when content is already visible: rejected because it conflates two different intents.
- Require moderators to always hide then unhide to clear a false positive: rejected because it creates meaningless content churn and confusing history.

## Risks / Trade-offs

- Lifecycle migrations can leave old reports with ambiguous status. -> Mitigation: backfill existing unresolved rows to `pending` and treat them as active on deploy.
- Bulk resolution may hide useful per-report nuance. -> Mitigation: keep historical rows with reviewer attribution and resolved status even though resolution is target-scoped.
- Duplicate-report prevention can surface new conflict paths in report submission. -> Mitigation: define a stable backend response for duplicate active reports and test concurrent insertion behavior.
- Adding a dismissal path can encourage scope creep toward full moderation workflows. -> Mitigation: keep this slice limited to status, reviewer attribution, uniqueness, queue semantics, and one no-action resolution operation.

## Migration Plan

1. Extend the report schema with lifecycle and reviewer attribution fields, plus any needed timestamps for resolution.
2. Backfill existing report rows into the active lifecycle state so current auto-hide and queue behavior remain consistent after deploy.
3. Add database constraints and indexes for active-report uniqueness per reporter and target.
4. Update queue aggregation and threshold logic to count only pending reports.
5. Introduce the shared moderator resolution behavior and the no-action dismissal path.
6. Add automated tests for lifecycle transitions, duplicate suppression, queue filtering, and moderator attribution.

Rollback:
- Revert the queue and service logic first, then back out the schema additions if needed.
- If rollback happens after lifecycle backfill, report rows can be treated as historical unresolved evidence because the previous system already operated without resolution semantics.

## Open Questions

- Whether moderator dismissal should expose a dedicated reason enum in this slice, or whether simple status transition plus reviewer attribution is sufficient for MVP.
- Whether auto-hidden content that is later manually unhidden should always resolve all pending reports, or only those that existed before the most recent moderator review window.