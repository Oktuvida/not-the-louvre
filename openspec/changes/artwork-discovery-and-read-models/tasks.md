## 1. Read-model foundations

- [ ] 1.1 Add artwork discovery query and projection modules for feed-card and detail read models
- [ ] 1.2 Implement canonical author-summary projection for artwork feed and detail reads
- [ ] 1.3 Implement media URL derivation from persisted artwork storage keys without exposing storage keys as the primary client contract

## 2. Feed discovery behavior

- [ ] 2.1 Implement the `Recent` artwork discovery flow with newest-first ordering
- [ ] 2.2 Implement stable pagination for discovery results suitable for infinite scroll continuation
- [ ] 2.3 Shape the discovery contract so additional sort modes can be added later without replacing the base API surface

## 3. Artwork detail and not-found semantics

- [ ] 3.1 Implement single-artwork detail retrieval using the dedicated detail projection
- [ ] 3.2 Ensure deleted artworks are excluded from discovery responses
- [ ] 3.3 Ensure deleted or unknown artwork detail requests return not found

## 4. Verification and integration coverage

- [ ] 4.1 Add integration tests for `Recent` feed ordering and pagination continuation behavior
- [ ] 4.2 Add integration tests for feed and detail projection shape, including author summary and media URL fields
- [ ] 4.3 Add integration tests for deleted-artwork omission and detail 404 behavior
