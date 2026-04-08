## Why

Recent gallery continuation work introduced a state-leak bug across room navigation. `your-studio`, `mystery`, and `hall-of-fame` can reuse buffered artworks and pagination state from the previously visited room, causing private and public feeds to bleed into each other and making the mystery reel depend on navigation history instead of its own discovery source.

## What Changes

- Isolate gallery continuation state per room so navigation never reuses artwork buffers, cursor state, or load-more errors from a previously visited room.
- Restore room-correct data sourcing so `your-studio` only shows the signed-in viewer's artworks, while `mystery` and `hall-of-fame` always use their own public discovery feeds regardless of the prior room.
- Add regression coverage for cross-room navigation paths that currently leak data between accumulators.
- Smooth infinite-scroll loading so appended content arrives less abruptly near the end of a room feed.

## Capabilities

### New Capabilities
- `gallery-room-state-isolation`: Guarantees each gallery room initializes and maintains its own continuation buffer and pagination lifecycle across in-app navigation.

### Modified Capabilities
- `artwork-discovery`: Gallery room presentation requirements change so room-specific discovery results remain stable and correctly scoped when the user navigates between gallery rooms.

## Impact

- Affected code: `apps/web/src/lib/features/gallery-exploration/GalleryExplorationPage.svelte`, continuation accumulators, room components, and gallery route tests.
- Affected systems: gallery room navigation, infinite scroll / continuation UX, mystery room bounded pool behavior.
- Risk areas: user-scoped studio privacy, public discovery correctness, pagination reset behavior, and virtualized load-more polish.
