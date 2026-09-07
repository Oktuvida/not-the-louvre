## Why

The homepage museum wall and teaser overlay still show mocked top-three artworks even though the app now has real publishing and gallery discovery. That means the first thing users see is still disconnected from the actual state of the product.

## What Changes

- Load the homepage top-three showcase from real backend artwork discovery instead of static mock preview cards.
- Replace the mocked home preview card state with route-provided ranked artwork data suitable for the existing wall/overlay presentation.
- Add honest empty-state behavior when there are fewer than three discoverable artworks.
- Keep the scope small and read-only: no homepage interaction redesign, voting, or realtime work.

## Capabilities

### New Capabilities
- `frontend-home-top-artworks`: Product-facing homepage top-artwork teaser that renders real ranked discovery results instead of static mock cards.

### Modified Capabilities
- `artwork-discovery`: Extend discovery requirements so the homepage can consume a real top-ranked subset for the entry experience.

## Impact

- Affected code: `apps/web/src/routes/+page.server.ts`, `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/features/home-entry-scene/components/MuseumWallOverlay.svelte`, and `apps/web/src/lib/features/home-entry-scene/state/home-entry.svelte.ts`.
- Affected backend boundaries: existing artwork discovery reader in `apps/web/src/lib/server/artwork/read.service.ts`.
- Affected systems: homepage teaser content, top-ranked artwork visibility, and entry-scene empty-state behavior.
