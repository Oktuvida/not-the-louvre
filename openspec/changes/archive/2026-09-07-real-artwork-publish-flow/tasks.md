## 1. Draw Route Publish Contract

- [x] 1.1 Add failing server-route tests for `/draw` covering auth gating, successful publish, backend failure mapping, and post-publish success state.
- [x] 1.2 Add `apps/web/src/routes/draw/+page.server.ts` with authenticated load behavior and a thin publish action that delegates to the existing artwork publishing service.
- [x] 1.3 Update backend publish handling as needed so the product draw route can submit a supported browser-exported source image while the backend still persists canonical AVIF output.

## 2. Product Draw Wiring

- [x] 2.1 Add failing component tests for `StudioDrawingPage.svelte`, `DrawingCanvas.svelte`, and `DrawingToolTray.svelte` that describe successful publish, retryable failure, and local export failure behavior.
- [x] 2.2 Refactor the draw components so the canvas can export browser-safe source media, submit it through the draw-route action, and preserve the current drawing on failure.
- [x] 2.3 Add a minimal post-publish success state on `/draw` that confirms the artwork was created and exposes the persisted result or next actions without depending on full gallery rewiring.

## 3. End-To-End Coverage

- [x] 3.1 Update the draw-route Playwright journey so an authenticated user can create and publish real artwork through the product flow.
- [x] 3.2 Add browser coverage for publish validation or export failure, proving the user stays on `/draw` and can retry.

## 4. Validation

- [x] 4.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, and resolve any failures caused by the real artwork publish flow change.
