# Product UX State Bug Fixes

## Context

The product has four user-facing bugs that all read as broken availability or broken state continuity rather than missing features. The home route can feel blocked by a Studio loading screen while the transformed GLB is still pending, gallery artwork detail does not cooperate with browser back on mobile, successful fork publishing leaves the inherited fork baseline behind on the draw canvas, and ambient audio starts too aggressively while forgetting which song the visitor had reached.

These bugs do not belong in one implementation bucket, but they do benefit from one validated design because they share the same product principle: the app should remain usable while heavy media loads and it should respect user state across navigation, publish, and reload boundaries.

## Goals / Non-Goals

**Goals:**
- Remove page-level blocking behavior from the home entry experience while the transformed Studio GLB loads.
- Make gallery artwork detail behave like an overlay layered on the current room so browser back closes it before leaving the page.
- Ensure successful fork publishing exits fork mode and returns the draw route to a clean new-artwork baseline.
- Make ambient audio opt-in by default and restore the last selected track across reloads without adding full playback-position persistence.
- Package the work as three OpenSpec changes so scope, testing, and implementation can stay discrete.

**Non-Goals:**
- Redesign the home entry scene, gallery composition, or audio UI visuals.
- Add exact playback timestamp resume for ambient audio.
- Rewrite the draw-route publish pipeline or backend artwork persistence contract.
- Introduce new backend schema work if the existing viewer content-preferences surface is sufficient.

## Decisions

### 1. Group the bugs into three changes, not one umbrella implementation

The approved packaging is:

1. `entry-gallery-usability-polish` for progressive home-scene loading plus gallery detail back-navigation behavior.
2. `fork-publish-canvas-reset` for successful fork publish cleanup.
3. `music-player-persistent-state` for ambient audio preference and track continuity.

This keeps the root/gallery browseability problems together while leaving draw-route state and audio persistence isolated. Keeping fork publish and audio separate avoids mixing unrelated tests and state machines.

### 2. Treat the transformed GLB as progressive enhancement, not a render gate

The home route should always render immediately. The transformed Studio GLB becomes media that enhances the scene once available rather than a prerequisite for seeing or using the page. The fallback remains localized to the scene surface and should read as a poster or matte placeholder instead of a blocking loading screen.

Why this direction:
- It directly addresses the user's complaint that the page feels unavailable while one heavy asset loads.
- It preserves the current scene composition and avoids inventing a second full entry experience.
- A localized fallback plus crossfade is a standard pattern for heavy 3D or media surfaces.

Alternative considered:
- Keep a loading screen but make it prettier or blurrier. Rejected because the problem is not aesthetics; the problem is that the page is blocked on one non-critical asset.

### 3. Model gallery artwork detail as local overlay history

Artwork detail opened from a room should add a history state that belongs to the current gallery page, so browser back first closes the detail overlay and only then leaves the room. The same close path should be shared by explicit close UI and by browser back to avoid divergent state cleanup.

Deep-linked or otherwise non-local detail states must keep normal history semantics. That prevents the gallery from hijacking back behavior when the artwork was not opened from the current room interaction.

Alternative considered:
- Intercept every browser-back event while detail is open. Rejected because it breaks direct-entry and restored-session cases.

### 4. Successful fork publish must explicitly exit fork mode before clearing the canvas

The current draw route likely resets to the fork seed because publish success reuses the fork's `initialDrawingDocument`. The correct behavior is to treat successful fork publish like the end of fork mode: clear fork persistence, drop the current parent, replace the initial baseline with a new empty document, and only then keep the user in the normal post-publish success state.

Alternative considered:
- Reset only `drawingDocument` while leaving `currentForkParent` and the initial baseline untouched. Rejected because draw-again and reload would still be able to revive the old parent state.

### 5. Keep ambient audio preference canonical, but make track continuity lightweight and local

The existing backend-backed on/off preference remains canonical for authenticated users. The missing behavior is first-visit default-off and the ability to resume the same song after reload. Track continuity should therefore be stored locally as a track identity hint, not as backend state and not as exact playback position.

Using track identity rather than a bare numeric index makes the behavior more robust if the playlist order changes. If the saved track no longer exists, the controller should gracefully fall back to the default first available track.

Alternative considered:
- Persist exact playback time or move current-track state into backend content preferences. Rejected because it expands scope into a much more fragile playback model than the bug report requires.

## Risks / Trade-offs

- [The localized scene fallback could feel visually flatter than the fully loaded GLB] -> Mitigation: keep the fallback atmospheric and transition to the model with a short crossfade instead of a hard swap.
- [Gallery history cleanup could leak handlers or stale detail state across room changes] -> Mitigation: unify all close paths and scope the local-history behavior to selections created by the current room session.
- [Fork-reset cleanup could accidentally clear non-fork success state] -> Mitigation: route successful fork publish through a dedicated helper that only activates when a parent artwork context exists.
- [Saved ambient track identity could become stale if the playlist changes] -> Mitigation: resolve by track ID and fall back to the default available track when the saved track is no longer present.

## Migration Plan

1. Create and validate three OpenSpec changes that capture the approved behavior and test expectations.
2. Implement each change independently with failing tests first, starting with the lowest-risk state fixes before any broader UI polish.
3. Roll back per change if needed; none of the changes require data migration or irreversible backend transformations.

## Open Questions

None. The approved design fixes scope, desired behaviors, and the minimal persistence model for the reported bugs.