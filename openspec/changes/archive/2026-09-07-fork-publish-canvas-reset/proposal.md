## Why

Successful fork publishing currently leaves the inherited fork artwork on the draw canvas instead of returning the user to a clean new-artwork state. That makes the flow feel half-reset and suggests the fork context is still active even after publish has already succeeded.

## What Changes

- Reset successful fork publish back to an empty new-artwork baseline instead of the fork seed document.
- Clear fork-specific draft, parent, and URL persistence once a fork publish succeeds so reload and draw-again do not revive the old parent.
- Keep non-fork publish success and publish failure behavior intact.
- Add component, route, and browser coverage for successful fork publish reset behavior.

## Capabilities

### New Capabilities
- `draw-fork-reset`: The draw route exits fork mode after a successful fork publish and returns to a clean new-artwork editing baseline.

### Modified Capabilities

## Impact

- Affected code: `apps/web/src/lib/features/studio-drawing/StudioDrawingPage.svelte`, draw-route tests, fork draft persistence helpers, and related browser journeys.
- Affected behavior: successful fork publish cleanup, draw-again behavior after fork publish, and reload behavior for forked draw sessions.
- Dependencies: existing draw-route publish flow, fork parent hydration on `/draw`, and draft-session persistence already used by the studio page.