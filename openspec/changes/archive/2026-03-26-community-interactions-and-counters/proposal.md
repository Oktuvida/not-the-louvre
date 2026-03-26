## Why

The backend can now authenticate users, persist artworks, and serve discovery reads, but the product still lacks the core social interactions that make the feed feel alive. The PRD places community interactions immediately after discovery, and this is the right moment to define votes, comments, and derived engagement counters before expanding into realtime delivery, lineage, or moderation workflows.

## What Changes

- Introduce backend vote behavior for artworks, including upvote, downvote, vote replacement, and vote removal.
- Introduce backend comment behavior for artworks, including creation, chronological reads, and author-controlled deletion.
- Add engagement-derived counters and score semantics so artwork reads can expose stable `score` and `commentCount` fields backed by the domain rather than UI placeholders.
- Extend artwork feed and detail read models to include engagement summaries needed by the product's current browsing surfaces.
- Add abuse protection for high-frequency engagement actions such as voting and commenting.
- Add automated backend coverage for vote transitions, comment lifecycle rules, derived counter consistency, and enriched artwork reads.

## Capabilities

### New Capabilities
- `community-interactions`: Artwork voting, comment lifecycle, derived engagement counters, and engagement-enriched artwork reads for the application backend.

### Modified Capabilities
- None.

## Impact

- Affected code: `apps/web/src/lib/server/db/schema.ts`, new vote/comment services and repositories, artwork read-model projection code, route handlers for vote/comment actions, and backend integration tests.
- Affected systems: PostgreSQL/Drizzle schema and migrations, artwork discovery/detail response contracts, authenticated authorization checks, and rate-limiting infrastructure for engagement actions.
- Dependencies: `identity-and-access` for canonical user identity and authorization, `artwork-publishing` for persisted artwork ownership, and `artwork-discovery` for the existing read-model surface being enriched.
- Follow-on work unlocked: realtime vote/comment delivery, `Hot` and `Top` feed ranking, fork engagement displays, reporting/moderation workflows, and richer social UI built on stable backend engagement behavior.
