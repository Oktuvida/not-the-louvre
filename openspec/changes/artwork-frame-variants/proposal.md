## Why

The gallery currently presents artworks with a mostly uniform card treatment, so the museum theme stops short of making each piece feel distinctly exhibited. We want framed presentation to become part of the product language while still preserving consistency, readability, and a clear visual reward for the top three ranked artworks.

## What Changes

- Introduce a product-facing artwork framing capability for gallery presentation surfaces.
- Assign each non-podium artwork a stable frame variant chosen deterministically from a curated standard pool so the collection feels varied without rerolling between visits.
- Reserve a separate premium frame tier for the top three ranked artworks only, with an explicit marker and future-friendly seam for richer styling later.
- Use `apps/web/static/html-objects/museum-frame.html` as the visual reference for the production frame language rather than shipping that standalone preview directly.
- Keep scope focused on presentation behavior and component integration; no ranking, voting, or discovery algorithm changes are included.

## Capabilities

### New Capabilities
- `artwork-framing`: Product-facing framed artwork presentation with deterministic standard variants and premium top-three treatment.

### Modified Capabilities
- `artwork-discovery`: Extend gallery presentation requirements so ranked and general discovery surfaces can render stable frame-tier metadata derived from artwork identity and podium position.

## Impact

- Affected code: `apps/web/src/lib/features/artwork-presentation/components/ArtworkCard.svelte`, `apps/web/src/lib/features/gallery-exploration/GalleryExplorationPage.svelte`, `apps/web/src/lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte` (if frame presentation is reused there), and new framing helpers/components under `apps/web/src/lib/features/artwork-presentation/`.
- Affected assets/reference artifacts: `apps/web/static/html-objects/museum-frame.html` as the visual source for production frame variants.
- Affected systems: gallery card presentation, hall-of-fame podium presentation, and test coverage for deterministic variant assignment and premium top-three treatment.
