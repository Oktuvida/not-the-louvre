## 1. Incremental Gallery Discovery

- [x] 1.1 Add failing route/server tests that describe gallery discovery continuation, including initial page metadata and follow-up cursor requests.
- [x] 1.2 Update gallery route/data loading so scalable rooms can request the first discovery segment and subsequent cursor-based segments without changing room semantics.
- [x] 1.3 Add browser or integration coverage proving sequential gallery continuation appends only new artworks in the same ordering.

## 2. Virtualized Rendering

- [x] 2.1 Add failing component/browser tests that describe bounded mounted-card behavior for scalable gallery rooms while scrolling.
- [x] 2.2 Introduce a virtualized gallery renderer for repeatable grid/list rooms so only the visible range plus overscan stays mounted.
- [x] 2.3 Preserve back-scroll behavior by recreating previously seen cards from loaded discovery data without eager detail fetches.

## 3. Detail Guardrails

- [x] 3.1 Add failing coverage proving virtualized browsing does not fetch per-artwork detail payloads until the user selects a card.
- [x] 3.2 Keep artwork detail opening functional from virtualized cards and verify room context remains intact.

## 4. Validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, and resolve any failures caused by the large-scale gallery loading change.
