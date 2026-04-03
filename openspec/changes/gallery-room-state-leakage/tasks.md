## 1. Reproduce the leakage with failing tests

- [x] 1.1 Add a failing `GalleryExplorationPage.svelte.spec.ts` test for `your-studio -> mystery` navigation proving the mystery reel reseeds from mystery data instead of the prior studio buffer
- [x] 1.2 Add a failing `GalleryExplorationPage.svelte.spec.ts` test for `hall-of-fame -> your-studio` navigation proving the studio excludes artworks from other users after entering from a public room
- [x] 1.3 Add a failing regression test proving continuation cursor/error state does not leak from one room to the next after rerender navigation

## 2. Isolate room-session continuation state

- [x] 2.1 Refactor `GalleryExplorationPage.svelte` so room accumulators are recreated or fully reset from the current room session seed when `roomId` and its discovery seed change
- [x] 2.2 Ensure `your-studio` and `hall-of-fame` append accumulators read their initial artworks and page metadata from the active room props only
- [x] 2.3 Ensure the mystery bounded-pool accumulator reseeds from the active mystery room props and does not retain buffered artworks from previously visited rooms
- [x] 2.4 Verify accumulator resets are keyed to room-session identity and do not fire on unrelated artwork detail patching inside the same room

## 3. Smooth append-style loading feedback

- [x] 3.1 Add a failing `ScrollSentinel` or gallery integration test covering earlier load triggering / room-matching loading feedback for append-style rooms
- [x] 3.2 Update scroll-trigger timing so append-style rooms begin loading before the user visually exhausts the current list
- [x] 3.3 Update loading placeholders so `your-studio` and `hall-of-fame` use room-appropriate grid geometry rather than one shared fallback layout

## 4. Verification

- [x] 4.1 Run `bun run format`
- [x] 4.2 Run `bun run lint`
- [x] 4.3 Run `bun run check`
- [ ] 4.4 Run `bun run test`
- [x] 4.5 Smoke-test `your-studio -> mystery`, `hall-of-fame -> your-studio`, and end-of-list loading behavior with seeded gallery data
