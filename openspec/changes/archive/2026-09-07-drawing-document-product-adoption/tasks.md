## 1. Shared drawing-document foundation

- [x] 1.1 Add failing tests for shared drawing-document persistence and backend-derived media rendering.
- [x] 1.2 Extend the application schema, repositories, and migrations so artworks and users can persist the drawing document source alongside derived media metadata.
- [x] 1.3 Implement shared backend helpers for drawing-document compression, storage encoding, SVG replay, and AVIF derivation.

## 2. Artwork product adoption

- [x] 2.1 Add failing draw-route and artwork-service tests covering JSON publish, JSON fork snapshotting, and compensating cleanup on failure.
- [x] 2.2 Refactor the draw route and studio components to edit a drawing document, recover local drafts, load fork snapshots, and publish the document through the backend.
- [x] 2.3 Update artwork read/bootstrap behavior as needed so fork flows can load the stored drawing document without relying on raster media.

## 3. Avatar product adoption

- [x] 3.1 Add failing avatar-service, home-route, and component tests covering JSON avatar save, local draft recovery, and avatar re-edit from stored source.
- [x] 3.2 Refactor avatar save and edit flows to submit a drawing document, persist the source in backend, and derive the avatar AVIF synchronously.

## 4. Validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and focused tests for the new drawing-document product adoption, resolving regressions caused by the change.