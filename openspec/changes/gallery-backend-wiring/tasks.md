## 1. Gallery Route Contract

- [x] 1.1 Add failing server-route tests for `/gallery` and `/gallery/[room]` covering default room loading, valid room loading, invalid room handling, and empty discovery state behavior.
- [x] 1.2 Add server loads for gallery routes that map product room ids onto the existing artwork discovery/detail services and return product-facing route data.
- [x] 1.3 Add any route-level model shaping needed so gallery pages can consume persisted discovery/detail data without depending on fixture records.

## 2. Gallery UI Wiring

- [x] 2.1 Add failing component tests for `GalleryExplorationPage.svelte` that describe real discovery rendering, artwork selection, and empty/error states.
- [x] 2.2 Replace fixture-backed gallery reads with route-provided real data while preserving room navigation and artwork selection behavior.
- [x] 2.3 Add a focused adapter between backend discovery/detail data and the existing gallery presentation model, removing direct dependency on `fixtures/artworks.ts` for runtime content.

## 3. End-To-End Coverage

- [x] 3.1 Update browser coverage so a newly published artwork can be rediscovered through the product gallery flow.
- [x] 3.2 Add browser coverage for gallery empty or unavailable states without falling back to mock content.

## 4. Validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, and resolve any failures caused by the gallery backend wiring change.
