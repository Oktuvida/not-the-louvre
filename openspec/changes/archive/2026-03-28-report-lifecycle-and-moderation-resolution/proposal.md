## Why

The backend already supports report submission, threshold-based auto-hide, hidden-content visibility rules, and a moderator queue, but moderation cases still behave like append-only counters instead of reviewable workflow objects. The PRD expects reports to carry review state and moderator attribution, and this is the right next slice because it closes a real governance gap without expanding into a full internal moderation product.

## What Changes

- Extend backend report persistence from append-only submissions to a reviewable lifecycle with explicit active and resolved states.
- Prevent duplicate active reports from the same reporter against the same moderation target so auto-hide thresholds reflect distinct reporters rather than repeated submissions.
- Record moderator resolution metadata for reviewed reports so moderation actions can close or action a case instead of leaving reports permanently pending.
- Make moderation queue reads operate on active report state rather than historical raw counts, while preserving pagination and mixed artwork/comment targets.
- Define how moderator hide, unhide, delete, and false-positive review decisions transition associated report state for artwork and comment targets.
- Add automated backend coverage for report uniqueness, resolution transitions, queue filtering, and moderator audit attribution.

## Capabilities

### New Capabilities
- `moderation-review-lifecycle`: Backend workflow for resolving moderation reports, including report state transitions, reviewer attribution, duplicate-active-report prevention, and target-level resolution semantics.

### Modified Capabilities
- `community-reporting`: Reporting requirements expand from submission and auto-hide only to include active-report uniqueness, report resolution state, and moderator-driven case closure behavior.
- `moderation-queue`: Queue requirements change from listing any reported content to listing moderation targets with active unresolved reports, excluding resolved cases unless they re-enter review.

## Impact

- Affected code: `apps/web/src/lib/server/db/schema.ts`, report-related migrations, moderation services and repositories, moderation queue read models, and backend integration/unit tests around report submission and moderator actions.
- Affected systems: PostgreSQL/Drizzle schema and constraints, moderation queue pagination and aggregation logic, moderator authorization checks, and auto-hide semantics that now depend on active report state.
- Dependencies: `identity-and-access` for canonical moderator identity, `community-reporting` for existing report submission and hidden-content behavior, and `moderation-queue` for moderator review reads.
- Follow-on work unlocked: moderator dashboards that distinguish pending vs resolved cases, internal moderation notes, user-warning flows, and more expressive moderation analytics built on durable report lifecycle data.