## Context

The gallery already has strong museum-themed styling, but artwork presentation is still mostly a shared card shell with minor rotation and leaderboard embellishments. Separately, `apps/web/static/html-objects/museum-frame.html` captures a richer gilded-frame visual direction with variantable proportions, matting, and aging, but it exists only as a standalone reference artifact and is not wired into the product.

This change needs a production-ready framing system that can be reused across gallery surfaces without introducing visual rerolls, leaking preview-only code into the app, or overcomplicating the current ranked-artwork flow. The system also needs an explicit premium tier for the podium top three while leaving room for a more refined premium art direction later.

## Goals / Non-Goals

**Goals:**
- Introduce a reusable artwork-frame presentation layer that follows the museum-frame reference language.
- Assign stable standard frame variants deterministically from artwork identity so the gallery feels curated rather than uniform.
- Reserve a premium frame tier for podium ranks 1 through 3 only.
- Keep premium handling obvious in code so future visual redesign can evolve it without refactoring the whole gallery.
- Preserve current gallery and hall-of-fame behaviors aside from the new framed presentation.

**Non-Goals:**
- Changing ranking, scoring, or podium selection rules.
- Shipping the standalone `museum-frame.html` preview directly in the product.
- Finalizing the complete premium visual language beyond a clear placeholder seam.
- Adding backend persistence for frame selection.

## Decisions

### 1. Create a frontend-owned frame system derived from reference presets
The product should translate the reference HTML artifact into a small, reusable frame-system module rather than attempt to embed or duplicate the preview page directly. That module should define curated presets for standard and premium frames, including tier, ornament profile, mat behavior, and aging intensity.

Alternative considered:
- Continue hand-styling each gallery surface independently: rejected because the frame language would drift immediately and premium treatment would become ad hoc.

### 2. Use deterministic variant assignment based on artwork identity
Standard frame selection should be stable for a given artwork by hashing or otherwise deterministically mapping artwork identity into the standard preset pool. This preserves variety across the collection without changing the same artwork's frame between renders, routes, or reloads.

Alternative considered:
- True runtime randomness on each render: rejected because it makes presentation feel glitchy and breaks the fiction that a work has a chosen frame.

### 3. Treat premium as a tier branch, not a one-off style override
Top-three podium artworks should branch into a `premium` tier before variant selection. The premium branch should still allow deterministic preset selection, but from a separate premium pool and with an obvious marker in the frame contract. This keeps future premium redesign isolated to preset data and frame rendering logic.

Alternative considered:
- Sprinkle podium-only CSS overrides directly into `GalleryExplorationPage.svelte`: rejected because it hides the product rule and makes later premium iteration harder.

### 4. Keep frame selection at the presentation boundary
Frame tier and variant can be derived from already-available frontend data (`artwork.id`, podium rank or podium context) instead of requiring a backend schema change. A small presentation helper or adapter should return a frame descriptor consumed by `ArtworkCard` and the podium artwork surface.

Alternative considered:
- Persist frame metadata in the backend: rejected for now because the requested behavior is deterministic and purely presentational.

### 5. Roll out through shared presentation primitives
The first consumers should be `ArtworkCard.svelte` and the hall-of-fame podium/grid surfaces in `GalleryExplorationPage.svelte`. If the resulting frame primitive composes cleanly, `ArtworkDetailPanel.svelte` can optionally reuse it; if not, that panel should remain out of scope for the first pass.

Alternative considered:
- Require every artwork surface to adopt frames in the first change: rejected because it widens scope before the shared primitive is proven.

## Risks / Trade-offs

- [Canvas-heavy ornament rendering could be expensive in dense gallery grids] -> Mitigation: keep the production frame primitive lightweight and selectively simplify the preview artifact's most expensive effects.
- [Premium and standard tiers may drift if they are encoded as scattered style branches] -> Mitigation: centralize tier and preset definitions in one frame-system module.
- [Deterministic variant assignment may feel repetitive with too few presets] -> Mitigation: use a curated pool with enough meaningful variation in profile, tone, and aging to avoid obvious repetition.
- [Podium-only premium treatment could create inconsistent styling between ranked and non-ranked views of the same artwork] -> Mitigation: document that premium is contextual to podium placement rather than a global persisted property.

## Migration Plan

1. Add failing component and helper tests that define deterministic frame assignment, premium podium behavior, and stable standard variants.
2. Introduce the shared frame contract and preset-selection helper.
3. Update artwork presentation surfaces to consume the frame descriptor.
4. Validate the gallery, podium, and any reused detail surface against the new frame behavior.
5. Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.

Rollback is straightforward because the change is frontend-owned: remove frame consumption from presentation surfaces and fall back to the existing card shells.

## Open Questions

- Whether the detail panel should adopt the same frame descriptor in this change or wait until the shared primitive is proven in gallery surfaces.
- How many premium presets should exist once the placeholder premium mark is replaced with a fully authored visual direction.
