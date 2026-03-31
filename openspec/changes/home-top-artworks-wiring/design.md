## Context

The homepage entry scene still uses `homePreviewCards` from `apps/web/src/lib/features/home-entry-scene/state/home-entry.svelte.ts`, which are fully mocked. That means the museum wall/overlay remains visually disconnected from the real publish and gallery systems that now exist.

The backend already exposes ranked discovery through the artwork read service, so this change is not about inventing a new feed. It is simply about using the existing top-ranked discovery output to populate the homepage teaser with up to three real artworks.

## Goals / Non-Goals

**Goals:**
- Load up to three real top-ranked artworks for the homepage entry experience.
- Replace the mocked home preview cards with route-provided data.
- Handle fewer-than-three and zero-artwork cases cleanly.

**Non-Goals:**
- Redesigning the home entry visuals.
- Adding homepage voting, detail modals, or realtime behavior.
- Reworking ranking logic or discovery algorithms.

## Decisions

### 1. Use the root route server load to fetch top-ranked discovery data
The homepage should extend `apps/web/src/routes/+page.server.ts` to load the top-ranked discovery subset used by the overlay. This keeps homepage read logic at the route boundary and reuses the existing artwork read service.

Alternative considered:
- Client-side fetch from the overlay component: rejected because this is simple route-owned read data and should be available at initial render.

### 2. Add a tiny adapter from discovery cards to home preview cards
The existing wall/overlay presentation should keep consuming a small `HomePreviewCard` shape. A focused adapter should translate discovery feed cards into that shape instead of rewriting the visual components around backend types.

Alternative considered:
- Pass backend discovery objects directly into the overlay: rejected because it leaks backend structure into a small presentation surface.

### 3. Use honest sparse-data fallback behavior
If there are fewer than three discoverable artworks, the homepage should render only the available real artworks and show no fake substitutes. If there are none, the entry wall should remain usable with a simple empty showcase state.

Alternative considered:
- Fill missing slots with mock cards: rejected because it keeps the homepage disconnected from product truth.

## Risks / Trade-offs

- [The overlay layout may assume exactly three cards] -> Mitigation: support a smaller array without backfilling fake content.
- [Top-ranked discovery may be empty early in development] -> Mitigation: add explicit empty-state behavior instead of silently failing.
- [Home entry components currently depend on static state files] -> Mitigation: isolate the change behind a small adapter and route prop wiring.

## Migration Plan

1. Add failing homepage route/component tests for real top-three data and empty-state behavior.
2. Extend the root route load to fetch top discovery results.
3. Replace static preview-card runtime data with adapted route data.
4. Run format, lint, check, and tests.

## Open Questions

- Whether the homepage should eventually link those top artworks into real detail views, or remain read-only for now.
