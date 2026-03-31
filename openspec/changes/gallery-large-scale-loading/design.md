## Context

The current gallery already has backend discovery readers with cursor-friendly foundations and now has basic lazy loading for route code and media. That helps startup cost, but it does not solve the large-scale case you called out: if the product needs to browse extremely large artwork sets, rendering hundreds or thousands of cards in one DOM tree will still create expensive layout, scrolling, memory, and image lifecycle behavior. Native image lazy loading alone will not actively unmount distant cards or give the app a bounded rendering cost.

The important product outcome is not merely "fewer initial requests"; it is bounded work while a visitor scrolls indefinitely. That requires two coordinated layers: incremental discovery fetches from the backend using cursors, and frontend virtualization so the browser only keeps a small window of cards mounted. Without both pieces, either the network payload grows too large or the DOM/memory footprint keeps growing during long sessions.

## Goals / Non-Goals

**Goals:**
- Consume gallery discovery incrementally through cursor-based continuation instead of one bounded route payload.
- Keep the number of mounted gallery cards bounded while scrolling through large feeds.
- Preserve room context, artwork detail-on-open behavior, and current gallery card semantics.
- Make the large-scale path testable through route, component, and browser coverage.

**Non-Goals:**
- Replacing the backend discovery ranking model or room taxonomy.
- Solving cross-session offline caching or browser cache eviction policy.
- Prefetching all artwork detail payloads.
- Full masonry layout optimization for variable-height artwork cards in this same change.

## Decisions

### 1. Use cursor-based incremental loading as the product contract for large gallery feeds

The gallery should request an initial discovery page and then request subsequent pages using the backend continuation cursor as the user approaches the end of the currently loaded range. This keeps server responses bounded and aligns with the backend discovery contract that was already designed for incremental loading.

Why this decision:
- It avoids one massive gallery payload.
- It fits existing discovery semantics better than offset pagination.
- It supports long-running browsing sessions with stable continuation.

Alternatives considered:
- Keep a large fixed route load size: rejected because it only postpones the scaling problem.
- Offset pagination: rejected because feed drift and duplicate/skip behavior are worse for evolving galleries.

### 2. Virtualize gallery cards in the browser so distant rows unmount

The gallery should render only the visible subset of cards plus a small overscan range. Cards far above or below the viewport should unmount, which naturally lets the browser drop DOM and image resources over time. Scrolling back should recreate those cards from already loaded item data and let the browser refetch or reuse cache according to its normal policy.

Why this decision:
- It directly addresses DOM and memory growth, which native image lazy loading alone does not solve.
- It keeps product behavior predictable for very large feeds.
- It provides the closest match to the user's requirement that older content should no longer stay fully resident while far offscreen.

Alternatives considered:
- Only lazy-load images: rejected because offscreen cards would still stay mounted in the DOM.
- Traditional pagination UI with page buttons: rejected because gallery browsing is better served by continuous scroll.

### 3. Scope virtualization first to the repeatable grid/list rooms

The first virtualization pass should target rooms that render repeatable discovery collections such as `your-studio` and the default gallery grid/card layouts. Highly custom rooms like podium layouts or the mystery reel may keep their specialized rendering paths until they show a real scaling problem.

Why this decision:
- It keeps the first large-scale solution targeted where item counts can grow the most.
- It avoids forcing a one-size-fits-all virtualization abstraction onto custom room presentations.
- It reduces regression risk in the most stylized rooms.

Alternatives considered:
- Virtualize every room immediately: rejected because the podium and reel experiences are structurally different and may not benefit proportionally.

### 4. Keep loaded item data in memory for the active session, but not the full mounted DOM

When users scroll back, the gallery should recreate cards from already fetched discovery data rather than re-request every page immediately. The optimization target is bounded DOM/rendering cost, not aggressive eviction of fetched JSON records. Browser-level image cache reuse can remain opportunistic.

Why this decision:
- It delivers good UX when users scroll back.
- It avoids network thrash from refetching every segment repeatedly.
- It keeps the implementation simpler and more reliable than custom in-app eviction in the first pass.

Alternatives considered:
- Aggressively evict fetched pages from application memory: rejected for now because it complicates scroll restoration and requires a stronger caching policy design.

## Risks / Trade-offs

- [Virtualization can break layout assumptions or keyboard navigation] -> Mitigation: target the repeatable rooms first and add user-facing interaction coverage.
- [Incremental loading can introduce duplicate or missing items if cursor handling is wrong] -> Mitigation: rely on stable backend cursor semantics and add continuation tests in the gallery layer.
- [Variable card heights can make virtualization less exact] -> Mitigation: start with rooms whose cards have predictable dimensions or row structure.
- [Keeping fetched data in memory still has a session cost for very long scrolls] -> Mitigation: bound DOM first, then measure whether application-level page eviction is necessary in a later change.

## Migration Plan

1. Add failing tests for incremental gallery continuation and bounded mounted-card behavior.
2. Extend gallery route/data loading to expose initial discovery page metadata and cursor continuation.
3. Add a virtualized gallery renderer for scalable rooms and wire it into the product gallery.
4. Add browser coverage for long-scroll continuation, back-scroll reconstruction, and room-context preservation.
5. Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.

Rollback:
- Revert the gallery to the current bounded non-virtualized rendering path while preserving backend discovery contracts.
- Disable incremental continuation at the UI layer if virtualization proves unstable.

## Open Questions

- Whether the first rollout should include `hall-of-fame` non-podium items immediately or stay limited to `your-studio` and the standard gallery grid.
- Whether long-session application-memory eviction is necessary after DOM virtualization is in place and measured.
