## Why

The backend now supports ranking and richer discovery, which means problematic content can be surfaced more effectively as well as engaging content. The PRD's next important backend concern is governance, but the full moderation phase is too large for one slice, so this change focuses on the minimal reporting and visibility controls needed to keep the system safe enough without absorbing dashboards, client-side NSFW gating, or broader admin tooling.

## What Changes

- Introduce backend reporting behavior so authenticated users can report artworks and comments with a structured reason and optional free-text context.
- Persist report state and define canonical moderation targets for artworks and comments.
- Add configurable auto-hide behavior so content is hidden from public discovery/detail reads once it crosses the active report threshold.
- Define hidden-content visibility semantics so public users stop seeing hidden content while authors and moderators retain the appropriate backend visibility.
- Add moderator actions for hide, unhide, and delete on reported artworks and comments.
- Enforce moderator authorization for moderation actions while keeping report submission available to authenticated users.
- Add automated backend coverage for reporting, auto-hide thresholds, visibility rules, and moderator action flows.

## Capabilities

### New Capabilities
- `community-reporting`: Reporting of artworks/comments, report persistence, auto-hide thresholds, visibility-state transitions, and moderator review actions for the application backend.

### Modified Capabilities
- `artwork-discovery`: Discovery and artwork-detail requirements expand so hidden artworks are excluded from public reads while remaining visible through authorized moderation/owner contexts.

## Impact

- Affected code: `apps/web/src/lib/server/db/schema.ts`, reporting/moderation services, artwork/comment read-model filters, moderator route handlers or actions, and backend integration tests.
- Affected systems: PostgreSQL/Drizzle schema and migrations, authorization checks based on user role, artwork/comment read visibility semantics, and report-threshold configuration.
- Dependencies: `identity-and-access` for canonical user identity and moderator roles, `artwork-discovery` for read filtering behavior, `community-interactions` for comment moderation targets, and `feed-ranking` because ranked feeds should respect hidden-content visibility.
- Follow-on work unlocked: moderation queues and dashboards, richer audit/review workflows, notification/warning systems, client-side NSFW integration, and future admin tooling built on stable report and visibility semantics.
