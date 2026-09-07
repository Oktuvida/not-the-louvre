## Why

Users can now sign up and publish real artwork, but `/gallery` and room pages still render fixture data. That breaks the product loop right after creation, because persisted artworks do not actually appear in the places where users expect to browse, rediscover, and compare them.

## What Changes

- Replace fixture-driven gallery feeds with real server-backed discovery data on `/gallery` and room routes.
- Add the minimum route and UI wiring needed to render persisted artworks, open real artwork detail, and handle empty/error states.
- Keep the scope functional-first: focus on reading and displaying real content, not gallery polish, ranking redesign, or full social/realtime layering.
- Define how room selection maps onto the existing backend discovery capabilities so the product gallery stops depending on mock room data.

## Capabilities

### New Capabilities
- `frontend-gallery-discovery`: Product-facing gallery routes that load persisted artwork discovery data, present meaningful empty/error states, and expose real artwork selection/detail behavior.

### Modified Capabilities
- `artwork-discovery`: Extend requirements so product gallery pages consume real persisted discovery data rather than fixture-only content, with route-level room and empty-state behavior.

## Impact

- Affected code: `apps/web/src/routes/gallery/+page.svelte`, `apps/web/src/routes/gallery/[room]/+page.svelte`, `apps/web/src/lib/features/gallery-exploration/GalleryExplorationPage.svelte`, `apps/web/src/lib/features/gallery-exploration/fixtures/artworks.ts`, and gallery tests.
- Affected backend boundaries: existing discovery/detail readers in `apps/web/src/lib/server/artwork/read.service.ts`, API routes under `apps/web/src/routes/api/artworks/`, and any new gallery route loads.
- Affected systems: post-publish content discovery, gallery room navigation, artwork detail selection, and first-pass browseability of real content.
- Dependencies: completed draw publish flow, canonical artwork persistence, and the existing discovery/detail backend contracts already used by demo routes.
