## Context

The current gallery already avoids loading with the application shell because SvelteKit splits route chunks by default. The remaining performance problem is inside the gallery route itself: `GalleryExplorationPage.svelte` statically imports room-specific components and shared presentation components, while artwork cards render standard `<img>` tags without explicit lazy loading in most rooms. As a result, opening `/gallery` can still eagerly decode artwork media and include room code that is irrelevant to the active room.

The existing gallery behavior should stay intact. The route already uses server-side data loading, artwork detail already loads on demand after selection, and room navigation is part of the current experience. The change therefore needs to optimize delivery without redesigning room semantics, changing ranking, or introducing client-only data fetches.

## Goals / Non-Goals

**Goals:**
- Reduce first gallery render cost by deferring room-specific UI code that is not needed for the current room.
- Ensure gallery artwork images load progressively with explicit browser hints instead of eager default behavior.
- Keep artwork detail loading on demand and avoid moving detail fetches into initial route load.
- Preserve current gallery behavior and cover the loading strategy with tests.

**Non-Goals:**
- Reworking gallery room layouts or visual design.
- Introducing infinite scroll, pagination, or virtualized lists in this change.
- Changing backend discovery contracts or room-to-query mapping.
- Replacing the current detail API flow with server-embedded detail payloads.

## Decisions

### 1. Add explicit lazy image loading to gallery artwork media

Artwork media rendered in gallery cards and frames should use `loading="lazy"` and `decoding="async"` unless the image is part of a clearly above-the-fold hero slot that must render immediately. This keeps the change small and lets the browser delay offscreen image work without new infrastructure.

Why this decision:
- The gallery is image-heavy, so browser-native media deferral is the fastest performance win.
- It does not require new APIs, observers, or placeholder systems.
- It matches the current implementation style and preserves existing markup.

Alternatives considered:
- Build a custom intersection-observer image component: rejected because it adds complexity before measuring whether native lazy loading is insufficient.
- Leave image loading to browser defaults: rejected because most gallery images currently provide no explicit hint and therefore do not communicate intent.

### 2. Split room-only UI with dynamic component loading inside the gallery route

Room components that are only needed for one branch of the gallery page should be loaded on demand through dynamic imports rather than static imports in `GalleryExplorationPage.svelte`. The active room can resolve its component asynchronously while other room code stays out of the initial gallery chunk.

Why this decision:
- The gallery already uses route-level splitting; this extends the same idea within the route where the current cost still exists.
- It targets the components with the clearest room-local scope.
- It improves loading without changing route contracts or room navigation URLs.

Alternatives considered:
- Leave all room components statically imported: rejected because every room implementation ships with the initial gallery route even though only one room is rendered.
- Split every shared component dynamically: rejected because it would add too much complexity and likely hurt interaction latency more than it helps.

### 3. Keep artwork detail fetch-on-open as the lazy boundary for heavy detail data

The current `loadArtworkDetail` behavior is already a useful lazy boundary. This change should preserve that design and only ensure that startup optimizations do not accidentally move detail payloads into the initial route or prefetch every artwork detail eagerly.

Why this decision:
- It already aligns with the product interaction model: details are only needed after selection.
- It avoids increasing initial data transfer for users who browse but do not open a piece.
- It keeps the change focused on gallery route performance instead of re-architecting detail transport.

Alternatives considered:
- Prefetch all visible artwork details on route load: rejected because it increases startup cost and duplicates data many users will never open.
- Prefetch detail on hover for every card: rejected because it adds complexity and could create wasteful network churn on touch devices or quick cursor movement.

### 4. Verify behavior at the user-facing boundaries instead of relying only on bundle inspection

Tests should prove that gallery cards still render, room navigation still works, and artwork selection still fetches detail lazily after the loading changes. Where appropriate, component tests can assert image loading attributes and browser tests can verify that gallery interaction remains functional.

Why this decision:
- The repository requires test-first behavior changes.
- Lazy loading changes are easy to overfit to implementation details unless verified through observable outcomes.
- It reduces the risk of performance work silently regressing product behavior.

Alternatives considered:
- Rely only on manual DevTools inspection: rejected because the repo standards require automated proof.

## Risks / Trade-offs

- [Dynamic room loading may introduce a brief intermediate state when switching rooms] -> Mitigation: keep the loading boundary small and provide a stable fallback shell rather than a blank region.
- [Native lazy image loading might delay media that users expect immediately above the fold] -> Mitigation: keep hero or first-slot exceptions available where immediate visibility matters.
- [Performance gains may be limited if the biggest cost is shared code rather than room-local code] -> Mitigation: target room components first, then validate with route behavior and chunk output during implementation.
- [Tests may become brittle if they depend on exact implementation mechanics] -> Mitigation: assert observable output, network timing boundaries, and explicit image attributes instead of framework internals.

## Migration Plan

1. Add failing tests that describe progressive gallery media loading and on-demand room/detail behavior.
2. Add explicit lazy loading attributes to gallery media components, preserving any above-the-fold exceptions needed by the layout.
3. Introduce dynamic loading for room-scoped components inside the gallery page while keeping the same room route behavior.
4. Verify that artwork detail still loads only after selection.
5. Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.

Rollback:
- Revert the room dynamic imports to static imports if room transitions become unstable.
- Revert media loading hints if they produce unacceptable visual regressions, without affecting backend or route contracts.

## Open Questions

- Whether the hall-of-fame podium images should remain eager because they are often immediately visible on `/gallery`.
- Whether to add low-quality placeholders now or defer that until after native lazy loading is measured in production-like runs.
