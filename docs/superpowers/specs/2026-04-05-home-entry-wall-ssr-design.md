# Home Entry Wall SSR Pattern Design

## Context

The home entry experience now keeps the route interactive while the studio GLB loads, but the first visual frame is still undermined by a second late asset: the museum wall pattern. Today that wall texture is produced in the browser with `createMuseumWallPatternUrl()` using a canvas and `toDataURL()` during mount. That means the initial paint can still show broad brown placeholder surfaces before both the wall texture and the GLB resolve.

The UX problem is not only that the GLB is heavy. It is that the user can see multiple incomplete visual layers arriving at different times. The first impression becomes “this is still loading expensive things” instead of “this page is already composed and polished.” The goal of this design is to make the wall pattern available on the first SSR render so the opening frame is visually coherent before any client-only scene enhancement arrives.

## Goals / Non-Goals

**Goals:**
- Make the home entry wall pattern available on the first render without waiting for client mount.
- Preserve the current museum-wall visual language closely enough that the scene still feels like the same product.
- Keep the wall pattern responsive across viewport sizes using deterministic CSS behavior rather than runtime canvas generation.
- Reuse the same wall pattern source for home and gallery so the visual system stays aligned.
- Avoid introducing an additional UX step or a new loading screen.

**Non-Goals:**
- Recreating the current canvas-generated wall texture pixel-for-pixel.
- Changing the GLB loading model beyond ensuring it sits on top of a coherent first frame.
- Adding a network-fetched wall image asset.
- Refactoring unrelated home-entry animation logic.

## Decisions

### 1. Replace client-only wall generation with an SSR-safe inline SVG tile

The museum wall pattern should be expressed as a deterministic, tileable SVG string that can be embedded directly into `background-image` as a `data:image/svg+xml` URL. That makes the pattern available during SSR and in the first HTML/CSS paint, with no client mount dependency and no additional network request.

Why this decision:
- It removes the current `onMount` bottleneck entirely.
- It keeps the pattern local to CSS background rendering, which matches how the wall is already consumed.
- It provides a better balance of fidelity and first-render reliability than a canvas-generated `data:` URL.

Alternatives considered:
- Keep canvas generation and try to start it earlier: rejected because client execution still loses the first-render race.
- Use a static image file: rejected because it introduces network variability into the first frame.
- Use gradients only: rejected because it would likely lose too much of the material feel of the wall.

### 2. Treat responsiveness as tile density control, not scene regeneration

The SVG should be designed as a repeating tile, not as a full-screen composition. Responsiveness then becomes a matter of `background-size` and repeat behavior rather than regenerating the wall per viewport or device pixel ratio.

Why this decision:
- A tile preserves texture continuity without distortion.
- CSS-driven density changes are stable across SSR and hydration.
- It keeps the implementation simple and predictable.

Alternatives considered:
- Generate different SVG payloads at runtime for different breakpoints: rejected because it reintroduces client-time branching and complexity.
- Stretch a single large SVG across the full scene: rejected because it would deform visually across viewports.

### 3. Use one canonical wall-pattern source across home and gallery

The wall pattern helper should become a shared SSR-safe source used by both the home-entry wall and gallery wall backgrounds. The gallery already uses the same conceptual texture but currently gets it from the same browser-generated canvas helper; both surfaces should instead consume the same SVG tile URL function.

Why this decision:
- It prevents the home and gallery from drifting visually.
- It avoids maintaining one SSR path and one client-only path for the same material language.
- It reduces future regressions where one surface loads late and the other does not.

Alternatives considered:
- Fix only the home route and leave gallery on canvas: rejected because it preserves unnecessary divergence.

### 4. Keep the GLB progressive, but only over a resolved base scene

Once the wall pattern exists at first paint, the GLB should continue to load progressively. The difference is that it now reveals on top of a scene whose wall and scene surface already look intentional. If the GLB fails, the wall pattern and base scene still look complete enough to avoid the impression of a broken loading pipeline.

Why this decision:
- The user concern is the perception of unpolished loading, not the existence of progressive 3D itself.
- A resolved wall pattern removes the most obvious “empty brown box” artifact without requiring the GLB to become blocking again.

Alternatives considered:
- Re-block the entire scene until the GLB and pattern are both ready: rejected because it reintroduces a hard gate and undermines the previous UX fix.

## Implementation Shape

1. Extract a new SSR-safe helper that returns the museum wall tile as an encoded SVG data URL.
2. Replace the current canvas-based wall pattern consumption in home and gallery with that SSR-safe helper.
3. Keep any existing canvas helpers that are still needed for other artwork or window-frame rendering, but remove the home/gallery dependency on canvas for wall texture.
4. Tune `background-size` so the wall density remains visually balanced across mobile and desktop without runtime measurement.
5. Keep the current localized GLB fallback, but verify it no longer exposes unfinished wall surfaces during first paint.

## Risks / Trade-offs

- [The SSR SVG may look slightly less rich than the canvas-generated pattern] -> Mitigation: preserve the same brick rhythm, mortar contrast, and tonal palette even if micro-detail is simplified.
- [A fixed tile size could feel oversized or undersized on one breakpoint] -> Mitigation: allow CSS breakpoint-level `background-size` adjustments rather than runtime regeneration.
- [Switching gallery to the same SSR helper could surface visual deltas outside the home page] -> Mitigation: treat shared visual consistency as intentional and validate both surfaces together.

## Validation Plan

1. Add SSR-oriented tests or assertions that the wall pattern background is present without waiting for `onMount`-driven mutation.
2. Add or update home-entry rendering tests to verify the initial frame stays visually coherent while the GLB is pending or fails.
3. Validate responsive behavior for at least one mobile and one desktop viewport.
4. Keep full repository checks in the existing order: `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.

## Open Questions

None. The approved direction is to move the wall pattern into an SSR-safe inline SVG tile and keep the GLB progressive over that resolved base.