## 1. Studio hot-path separation

- [x] 1.1 Add transient active-stroke state and explicit stroke-commit handling to the studio drawing canvas.
- [x] 1.2 Stop mutating the canonical drawing document and notifying parent state on every pointer move while a stroke is active.
- [x] 1.3 Add component coverage proving buffered studio strokes commit exact captured points in one canonical append.

## 2. Stroke-boundary sync and activation

- [x] 2.1 Change studio draft persistence to save only completed strokes instead of point-by-point updates.
- [x] 2.2 Add automatic large-document activation heuristics for hydrated, existing, and forked studio drawings.
- [x] 2.3 Add tests proving dense pointer moves do not autosave or synchronize intermediate canonical documents.

## 3. Committed-content render acceleration

- [x] 3.1 Implement a committed-content raster cache with invalidation on hydration changes, stroke commits, clears, and fork resets.
- [x] 3.2 Render the active stroke as an overlay on top of committed cached content during responsive editing mode.
- [x] 3.3 Add regressions proving hydration resets and publish preparation still derive from the canonical Stroke JSON document.

## 4. Shared surface rollout and verification

- [x] 4.1 Apply the responsive editing contract to the avatar sketch surface using shared helpers or equivalent shared tests.
- [x] 4.2 Add browser-level regressions for dense drawing over large hydrated bases in studio and avatar flows.
- [x] 4.3 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, then fix any failures caused by this change.