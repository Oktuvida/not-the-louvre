## 1. Ranked discovery contract foundations

- [x] 1.1 Add failing validation and route tests for supported feed sorts (`Recent`, `Hot`, `Top`) and supported `Top` windows.
- [x] 1.2 Extend discovery query contracts and shared types to represent ranked sort selection, top-window selection, and deterministic ranked cursors.
- [x] 1.3 Add failing read-model tests that describe hot ordering, top-window filtering, deterministic tie-breaking, and ranked pagination continuity.

## 2. Hot and Top ranking implementation

- [x] 2.1 Implement `Hot` ranking behavior in the artwork discovery read layer using persisted engagement state and recency weighting.
- [x] 2.2 Implement `Top` ranking behavior for `Today`, `This Week`, and `All Time` windows in the artwork discovery read layer.
- [x] 2.3 Ensure ranked feeds preserve the canonical feed-card projection and validate the behavior with automated tests.

## 3. Ranked feed boundary validation

- [x] 3.1 Add or update server boundary tests that exercise ranked discovery requests, invalid sort/window rejection, and ranked cursor continuation.
- [x] 3.2 Verify ranked feeds remain compatible with existing active-content and not-found semantics for discovery reads.

## 4. Quality validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test` and resolve any failures.
