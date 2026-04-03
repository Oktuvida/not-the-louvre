## Context

The gallery now relies on shared continuation helpers for `your-studio`, `hall-of-fame`, and `mystery`. In `GalleryExplorationPage.svelte`, those accumulators are instantiated once at component setup time from the current `artworks` and `discovery` props. Route navigation changes the rendered room branch, but it does not recreate the accumulator instances or clear their buffered pages, cursor state, and error state.

That mismatch creates a cross-room state leak:

- entering `mystery` from `your-studio` can seed the reel with viewer-scoped artworks instead of the mystery feed
- entering `your-studio` from a public room can surface public artworks that do not belong to the viewer
- `hasMore`, `nextCursor`, and failed-load state can carry over from the prior room

Separately, the current infinite-scroll loading feedback feels abrupt because the sentinel fires close to the end of the rendered content and the loading skeleton does not match the geometry of the room that is appending content.

## Goals / Non-Goals

**Goals:**

- Make continuation state room-local so each gallery room always uses its own server-provided discovery seed.
- Ensure room navigation resets buffered artworks, pagination cursors, and continuation errors when the room identity changes.
- Preserve the existing continuation models per room: append for scrollable grids, bounded pool for mystery.
- Reduce the visual harshness of infinite-scroll appends by making the loading phase feel more continuous.
- Add regression coverage for the navigation paths that currently reproduce the bug.

**Non-Goals:**

- Changing backend discovery queries, ranking rules, or cursor formats.
- Redesigning room layouts or replacing `virtua`.
- Reworking mystery room animation behavior beyond what is necessary to keep its source data correct.

## Decisions

### 1. Treat continuation state as room-session state, not page-lifetime state

**Choice:** Recreate or explicitly reset each accumulator whenever the effective room session changes. The room session is defined by the room identity plus its initial discovery seed (`artworks` + `pageInfo` + request scope).

**Rationale:** The current bug exists because accumulator lifetime is longer than room lifetime. The safest fix is to tie the continuation buffer to the room session that produced it, so navigating to a different room cannot reuse prior buffered data.

**Alternatives considered:**

- Keep one long-lived accumulator per room ID in the parent component. Rejected because it still requires cache invalidation when SSR data changes, and it increases the chance of stale cross-navigation state surviving longer than intended.
- Patch the existing accumulators imperatively on room change. Accepted only if the reset is complete and testable; partial resets are too easy to get wrong.

### 2. Make room props the single source of truth for initial continuation state

**Choice:** On every room session change, the accumulator seed MUST come from the current route props for that room, not from previously appended local state.

**Rationale:** Server-loaded room props already encode the correct room scope:

- `your-studio` is viewer-scoped and filtered to the signed-in user's artworks
- `mystery` is public `recent`
- `hall-of-fame` is public `top`

If the frontend always reseeds from the current props, navigation history cannot alter which artworks belong to a room.

**Alternatives considered:**

- Trust deduplication alone to prevent leakage. Rejected because dedup only prevents duplicate IDs; it does not prevent wrong-scope artworks from entering the buffer.

### 3. Keep room-specific continuation policies, but isolate their state containers

**Choice:** `your-studio` and `hall-of-fame` continue using append-style accumulation, while `mystery` continues using the bounded pool. The change is state isolation, not policy unification.

**Rationale:** The existing policies match the room UX. The regression came from shared lifetime semantics, not from the append vs bounded-pool choice itself.

**Alternatives considered:**

- Collapse all rooms onto a single accumulator abstraction with room flags. Rejected because it couples unrelated continuation semantics and makes the mystery reel harder to reason about.

### 4. Smooth append feedback with earlier trigger margin and room-matching placeholders

**Choice:** Adjust load-more feedback so scroll-triggered rooms start loading slightly earlier and render placeholders that match the active room's grid geometry more closely.

**Rationale:** The abruptness is not only the new data arriving; it is also the mismatch between sentinel timing and skeleton layout. Fetching slightly earlier and keeping the loading row visually consistent should reduce the perceived jump without changing the underlying continuation contract.

**Alternatives considered:**

- Add complex animated insertion transitions for virtualized rows. Rejected as unnecessary for the bug fix and more fragile with virtualization.

## Risks / Trade-offs

- **[Risk] Room-session reset may discard intentionally cached continuation state when a user revisits a room** → Mitigation: prefer correctness over hidden caching; if revisit caching becomes a product need later, it can be added explicitly with room-keyed cache semantics.
- **[Risk] Resetting accumulators on prop changes could also reset on unrelated artwork detail updates** → Mitigation: key resets to room session identity, not arbitrary reactive changes such as vote/comment patching.
- **[Risk] Earlier sentinel triggering may increase pre-end fetch frequency** → Mitigation: existing `isLoading` guards already suppress duplicate in-flight requests.
- **[Risk] Skeleton/layout tuning may differ between hall-of-fame and your-studio** → Mitigation: make loading presentation configurable per room instead of assuming one shared grid shape.

## Migration Plan

1. Add failing regression tests that reproduce `your-studio -> mystery` and `hall-of-fame -> your-studio` leakage.
2. Refactor accumulator lifecycle so each room session seeds from the current route props and resets cleanly on room change.
3. Update scroll loading presentation for append-style rooms and validate that existing continuation tests still pass.
4. Run full gallery quality gates and smoke-test room navigation paths with seeded data.

Rollback is straightforward: revert the room-session lifecycle changes and loading-feedback tuning together.

## Open Questions

- Should revisiting a room within the same browser session restore its previously fetched pages, or always reseed from SSR? This change assumes reseed-for-correctness.
- Is the current abruptness fully solved by sentinel timing and placeholder geometry, or do we also want subtle fade-in for newly appended rows in a follow-up?
