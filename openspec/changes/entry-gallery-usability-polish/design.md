## Context

Two browseability bugs are being fixed together because they both make the product feel unavailable at the exact moment a visitor tries to explore it. `StudioScene.svelte` currently gates the scene behind `StudioLoadingFallback` until `/models/studio-transformed.glb` resolves or errors. Even though the rest of the home route can already render, the result still reads like a loading screen attached to the root experience. Separately, `GalleryExplorationPage.svelte` keeps `selectedArtwork` only in component state and closes it by assigning `null`, which means browser back skips straight to route navigation instead of first closing detail on mobile.

The change must improve these behaviors without redesigning either surface. The home route still uses the same scene, and the gallery still uses the same room and detail model. The implementation needs to stay local to the existing scene and gallery components, preserve deep-link-safe history semantics, and remain robust under GLB load failure.

## Goals / Non-Goals

**Goals:**
- Keep the home route usable while the Studio GLB is pending or fails.
- Reduce the loading experience to a localized scene placeholder rather than a page-level blocker.
- Make in-room artwork detail close on browser back before the gallery route exits.
- Preserve normal history behavior for detail states not opened from the current room.
- Prove the behavior with component and browser tests, including mobile back-navigation coverage.

**Non-Goals:**
- Redesigning the home scene visuals or changing the auth-entry flow.
- Adding a dedicated gallery artwork route or rewriting gallery data loading.
- Prefetching artwork detail for every visible artwork.
- Changing desktop gallery information architecture.

## Decisions

### 1. Treat the Studio GLB as progressive scene media

The home route should mount and remain interactive immediately. The transformed GLB is treated as media that improves the scene once available. `StudioLoadingFallback` therefore becomes a localized placeholder layer within the scene surface and must not visually read as the app waiting to start.

Why this decision:
- The user complaint is about app availability, not about the asset taking time.
- The GLB is the one heavy dependency in this path, so it should not block unrelated controls.
- A localized poster-like fallback plus crossfade keeps the existing scene intact.

Alternatives considered:
- Keep a full loading surface but add blur or different copy: rejected because it still blocks the perceived page.
- Hide the entire scene until the GLB loads: rejected because it makes the entry state look broken on slow networks.

### 2. Keep the fallback localized and non-blocking

The fallback stays inside the scene container, uses the existing visual language, and remains non-blocking to surrounding page controls. If the GLB fails, that fallback simply remains the final scene surface instead of escalating into a global error or waiting state.

Why this decision:
- It isolates the loading concern to the place where the asset matters.
- It avoids introducing a new app-level state just for one 3D model.

Alternatives considered:
- Replace the scene with a plain spinner: rejected because it drops too much visual continuity and still reads as blocked.

### 3. Model gallery detail as local history opened from room selection

When a visitor opens artwork detail from the current gallery room, the page should create a lightweight history entry tied to that overlay state. Browser back then pops the overlay first and leaves the room intact. Explicit close UI and browser back must both funnel through the same close path so selected-artwork cleanup, error reset, and history reconciliation do not drift apart.

Why this decision:
- The artwork detail is conceptually an overlay on the current room, not a route transition.
- Mobile users expect browser back to reverse the last visible layer before leaving the page.

Alternatives considered:
- Intercept all back navigation while detail is open: rejected because it hijacks normal history for non-local detail states.
- Ignore browser history and rely only on the close button: rejected because it does not solve the mobile gesture problem.

### 4. Limit back interception to locally opened detail states

The gallery should only install local detail-history behavior when the current detail view originated from selecting artwork inside the room. Deep-linked, restored, or otherwise non-local detail states keep normal browser-history semantics.

Why this decision:
- It preserves the web's default history model where the page did not create the last state transition itself.
- It keeps the implementation narrow and avoids surprising behavior for future shareable-detail states.

Alternatives considered:
- Force local close semantics for every detail state: rejected because it would conflict with direct-entry expectations.

## Risks / Trade-offs

- [The localized scene fallback may still feel visually prominent on very small screens] -> Mitigation: keep it atmospheric and transition out quickly when the GLB resolves.
- [Gallery detail history state may become stale during room changes] -> Mitigation: clear or replace local detail-history markers whenever the selected artwork or room context changes.
- [Testing browser back can be brittle in unit tests] -> Mitigation: cover the close-path contract in component tests and reserve full history-stack behavior for browser-level tests.

## Migration Plan

1. Add failing tests for localized scene availability and gallery mobile back behavior.
2. Refactor `StudioScene.svelte` and the scene fallback so the root experience remains usable without waiting for the GLB.
3. Introduce room-local detail-history behavior in `GalleryExplorationPage.svelte`, reusing one close path for explicit close and browser back.
4. Validate the change with `bun run format`, `bun run lint`, `bun run check`, and `bun run test` during implementation.

## Open Questions

None. The change is intentionally constrained around progressive availability and local history correctness.