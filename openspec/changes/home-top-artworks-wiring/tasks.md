## 1. Homepage Data Wiring

- [x] 1.1 Add failing root-route tests for homepage top-artwork loading and empty teaser behavior.
- [x] 1.2 Extend `apps/web/src/routes/+page.server.ts` to load up to three top-ranked artworks for the homepage entry scene.
- [x] 1.3 Add a small adapter from discovery feed cards to `HomePreviewCard` data for the homepage overlay.

## 2. Homepage UI Wiring

- [x] 2.1 Add failing component tests for the homepage wall/overlay using real preview-card data and empty-state behavior.
- [x] 2.2 Replace the mocked runtime preview cards with route-provided top-artwork data while preserving the existing presentation.

## 3. Validation

- [x] 3.1 Run `bun run format`, `bun run lint`, `bun run check`, and the relevant test suites, and resolve any failures caused by the homepage top-artworks wiring change.
