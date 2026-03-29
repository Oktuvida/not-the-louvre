## 1. Frame Contract and Deterministic Selection

- [x] 1.1 Add failing unit tests for frame-tier and variant selection, covering stable deterministic assignment for standard artworks and premium assignment for podium positions 1 through 3 only.
- [x] 1.2 Implement a shared artwork-frame contract plus curated standard and premium preset pools derived from the museum-frame reference artifact.
- [x] 1.3 Implement the deterministic frame-selection helper that maps artwork identity and podium context into a frame descriptor with explicit `standard` or `premium` tiering.

## 2. Shared Presentation Primitives

- [x] 2.1 Add failing component tests for the shared framed-artwork presentation primitive or adapted `ArtworkCard` behavior using the frame descriptor.
- [x] 2.2 Implement the reusable frame presentation layer for standard and premium variants, keeping premium styling behind an obvious placeholder seam for later design refinement.

## 3. Gallery Surface Integration

- [x] 3.1 Add failing component tests for `apps/web/src/lib/features/gallery-exploration/GalleryExplorationPage.svelte` and `apps/web/src/lib/features/artwork-presentation/components/ArtworkCard.svelte` that cover framed standard artworks and premium top-three podium artworks.
- [x] 3.2 Wire standard framed presentation into gallery cards and non-podium ranked artwork surfaces.
- [x] 3.3 Wire premium framed presentation into the podium top-three surfaces without changing ranking behavior.
- [x] 3.4 Decide whether `apps/web/src/lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte` should consume the shared frame descriptor in this change; if yes, add failing tests first and integrate it, otherwise leave it unchanged.

## 4. Validation

- [ ] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, and resolve any failures introduced by the artwork frame variants change.
