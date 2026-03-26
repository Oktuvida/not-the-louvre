## 1. Read-model foundations

- [x] 1.1 Add artwork discovery query and projection modules for feed-card and detail read models
- [x] 1.2 Implement canonical author-summary projection for artwork feed and detail reads
- [x] 1.3 Implement media URL derivation from persisted artwork storage keys without exposing storage keys as the primary client contract

## 2. Feed discovery behavior

- [x] 2.1 Implement the `Recent` artwork discovery flow with newest-first ordering
- [x] 2.2 Implement stable pagination for discovery results suitable for infinite scroll continuation
- [x] 2.3 Shape the discovery contract so additional sort modes can be added later without replacing the base API surface

## 3. Artwork detail and not-found semantics

- [x] 3.1 Implement single-artwork detail retrieval using the dedicated detail projection
- [x] 3.2 Ensure deleted artworks are excluded from discovery responses
- [x] 3.3 Ensure deleted or unknown artwork detail requests return not found

## 4. Verification and integration coverage

- [x] 4.1 Add integration tests for `Recent` feed ordering and pagination continuation behavior
- [x] 4.2 Add integration tests for feed and detail projection shape, including author summary and media URL fields
- [x] 4.3 Add integration tests for deleted-artwork omission and detail 404 behavior
