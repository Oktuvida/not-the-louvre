## 1. Coverage

- [x] 1.1 Add failing component and browser tests for home-route progressive scene loading and localized fallback behavior
- [x] 1.2 Add failing gallery tests covering local artwork-detail history and mobile browser-back behavior

## 2. Home Scene Progressive Loading

- [x] 2.1 Refactor `StudioScene.svelte` so the home route remains usable while the transformed GLB is pending or fails
- [x] 2.2 Update `StudioLoadingFallback.svelte` and related scene markup to behave as a localized, non-blocking placeholder with a smooth transition into the loaded model
- [x] 2.3 Verify home entry controls remain usable regardless of GLB state

## 3. Gallery Detail History

- [x] 3.1 Add gallery detail state that can be represented in local browser history without changing room navigation semantics, and clear stale local detail-history markers when room or selected-artwork context changes
- [x] 3.2 Unify explicit close and browser-back behavior for artwork detail opened from the current room
- [x] 3.3 Preserve normal browser-history behavior for deep-linked or otherwise non-local detail states

## 4. Validation

- [x] 4.1 Run `bun run format`
- [x] 4.2 Run `bun run lint`
- [x] 4.3 Run `bun run check`
- [x] 4.4 Run `bun run test`