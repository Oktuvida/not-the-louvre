## Why

The app now has real auth and onboarding, but the core creation route is still fake: `/draw` lets users sketch, yet pressing publish only updates local UI state and does not create any backend artwork. That means the product still lacks its first real user value loop, because authenticated users cannot actually make content that exists beyond the current page.

## What Changes

- Wire the `/draw` route to the existing authenticated artwork publishing backend so canvas output becomes a real persisted artwork.
- Add the minimum route/server contract needed for the draw page to export canvas media, submit it, surface validation errors, and confirm success.
- Keep the product scope narrow: prioritize functional artwork creation over visual polish, animation work, or broad gallery redesign.
- Define what the user sees immediately after a successful publish so the flow ends in a clear, usable state.

## Capabilities

### New Capabilities
- `frontend-artwork-publish-flow`: Product-facing draw-route publishing flow that exports the current canvas, submits it through the backend, handles failure states, and completes with a usable success outcome.

### Modified Capabilities
- `artwork-publishing`: Extend requirements so the product draw route can publish through the existing backend contract, including minimal success and failure behavior for the functional web app flow.

## Impact

- Affected code: `apps/web/src/routes/draw/+page.svelte`, `apps/web/src/lib/features/studio-drawing/StudioDrawingPage.svelte`, `apps/web/src/lib/features/studio-drawing/components/DrawingCanvas.svelte`, `apps/web/src/lib/features/studio-drawing/tools/DrawingToolTray.svelte`, and draw-route tests.
- Affected backend boundaries: existing publish route at `apps/web/src/routes/api/artworks/+server.ts`, artwork publishing services under `apps/web/src/lib/server/artwork/`, and any thin draw-route server action or page contract introduced for product wiring.
- Affected systems: authenticated creation flow, publish validation feedback, and the first durable content loop for signed-in users.
- Dependencies: canonical auth bootstrap already completed on the home route, existing artwork publishing contract/spec, and media sanitization rules enforced by the backend.
