## 1. Progressive Media Loading

- [x] 1.1 Add failing component or browser tests that describe explicit lazy loading behavior for non-critical gallery artwork images.
- [x] 1.2 Update gallery media renderers such as `ArtworkCard.svelte`, `PolaroidCard.svelte`, and any room-specific artwork frames to apply the intended `loading` and `decoding` strategy.
- [x] 1.3 Preserve any above-the-fold exceptions needed for immediately visible hero artwork and cover them with assertions.

## 2. Room-Level Code Deferral

- [x] 2.1 Add failing tests that describe gallery room rendering and room switching while room-scoped UI is loaded on demand.
- [x] 2.2 Replace static room-only imports in `GalleryExplorationPage.svelte` with an on-demand loading boundary that keeps current room behavior intact.
- [x] 2.3 Add any minimal loading fallback needed so room transitions remain stable during asynchronous room resolution.

## 3. Detail Loading Guardrails

- [x] 3.1 Add failing coverage proving that gallery detail payloads are not fetched for every artwork during initial route render.
- [x] 3.2 Preserve the current fetch-on-open detail behavior and update tests to prove detail still loads when an artwork is selected.

## 4. Validation

- [ ] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, and resolve any failures caused by the gallery lazy loading change.
