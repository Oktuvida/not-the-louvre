## Context

The app now has a mostly real account lifecycle, but the `/draw` route is still presentation-only. `apps/web/src/lib/features/studio-drawing/StudioDrawingPage.svelte` currently treats publish as a local timestamp update, and `apps/web/src/routes/draw/+page.svelte` has no server contract at all. That means the first product action that should matter most - making art - still does not cross the backend boundary.

There is already a working backend publish contract in place: `apps/web/src/routes/api/artworks/+server.ts`, `apps/web/src/lib/server/artwork/service.ts`, and the demo route at `apps/web/src/routes/demo/artwork-publish/+page.server.ts` show how authenticated publishing, error mapping, and success redirects already work. The gap is therefore product wiring and input format strategy, not missing persistence primitives.

The most important current constraint is that the browser draw surface is a canvas, while the current publishing contract expects client-submitted AVIF. That mismatch is likely to make the first product publish path fragile or non-functional in real browsers, especially if the client is forced to do AVIF encoding itself. Because the user explicitly wants function over polish, the design should prefer the most dependable route to persisted artwork rather than the most elegant media contract.

## Goals / Non-Goals

**Goals:**
- Make the `/draw` route publish a real artwork through the backend.
- Keep the implementation narrow and product-facing: export the current canvas, submit it, map failures, and confirm success.
- Reuse existing backend publishing services instead of inventing a second content pipeline.
- End the flow in a clearly usable success state without requiring full gallery rewiring in the same change.
- Add route, component, and browser coverage that proves a signed-in user can create durable content.

**Non-Goals:**
- Rebuilding the gallery to show newly published content in this same change.
- Redesigning the draw studio visuals, animation system, or tool affordances.
- Building full artwork detail, voting, or comment flows here.
- Solving all media pipeline concerns for every future input surface beyond the current draw canvas.

## Decisions

### 1. Add a dedicated draw-route server action instead of posting directly to `/api/artworks` from the component

`/draw` should gain a `+page.server.ts` with authenticated bootstrap and a publish action, following the same pattern already used in the demo routes and home auth wiring. The drawing UI then submits through same-page form semantics rather than hand-rolled ad hoc fetch orchestration.

Why this decision:
- It matches the product pattern already established on the home route and demo pages.
- It gives the draw page one place to map backend publish failures into user-facing form state.
- It keeps auth gating and publish completion logic on the route that owns the creation flow.

Alternatives considered:
- Call `/api/artworks` directly from the browser: rejected because it splits product behavior across two transport patterns and makes the component own too much protocol detail.
- Keep the current local-only publish illusion until gallery wiring exists: rejected because the user explicitly wants the app functional before it is polished.

### 2. Export canvas content with browser-friendly fallback order and let the backend sanitize it into canonical artwork media

The draw UI should not depend on client-side AVIF encoding. Instead, it should export the canvas using a browser-friendly fallback order: prefer WebP, fall back to JPEG, and use PNG only as the last resort. The backend publishing contract should be updated so product-owned draw submissions can arrive in one of those supported source formats and still be sanitized into canonical persisted AVIF before storage.

Why this decision:
- Browser canvas AVIF encoding is the least reliable part of the flow, and it should not block the first content loop.
- WebP gives the best balance of browser support and upload size for painted canvas content, with JPEG and PNG as practical fallbacks.
- The backend already owns sanitization and canonical output, which is the right place to normalize media.
- This makes the product path functional sooner without weakening the stored-media contract.

Alternatives considered:
- Require the draw page to export AVIF in-browser: rejected because it is fragile and already suspect in real browser behavior.
- Default to PNG first: rejected because it is heavier than WebP or JPEG for most painted artwork and should only be used as the last fallback.
- Add a separate draw-only conversion service: rejected because the existing artwork publishing service is already the natural sanitation boundary.

### 3. Keep publish success local to the draw route for now, with a durable success result rather than immediate gallery dependency

After successful publish, the draw page should move into a clear success state that includes the persisted artwork identity and actionable next steps, such as drawing again or opening the gallery. The route should not depend on gallery read wiring being complete before it can confirm success.

Why this decision:
- It keeps the scope focused on one main task: creation actually works.
- It avoids coupling this change to the still-mocked gallery feed.
- It still produces a truthful product outcome: the artwork exists and the user knows publishing succeeded.

Alternatives considered:
- Redirect immediately into the gallery and require the new artwork to appear there: rejected because that turns one main task into two coupled tasks.
- Stay on the exact same draw state with only a toast: rejected because it makes success too easy to miss and does not expose the persisted outcome clearly enough.

### 4. Reuse backend failure codes and keep client-side validation minimal

The draw route should do only the minimum pre-submit checks needed to prevent obviously empty or missing media. The backend remains authoritative for media validation, abuse protection, and publish constraints, and the route action should preserve backend `code` and `message` values for the UI.

Why this decision:
- It avoids duplicating publish validation rules in the drawing components.
- It aligns with the route/action pattern already used for auth.
- It keeps the functional path honest: failure reasons come from the actual publishing boundary.

Alternatives considered:
- Reimplement all artwork validations in the browser: rejected because it increases drift and does not meaningfully improve the first functional milestone.

### 5. Treat draw publishing as an authenticated feature, not a public drafting surface

The draw route should require an authenticated canonical user. If the session is missing or invalid, the route should redirect the user back into the auth/onboarding entry flow rather than allowing anonymous local drafts to masquerade as publishable content.

Why this decision:
- The publish backend already depends on authenticated ownership.
- It makes the product loop coherent: sign in, draw, publish.
- It avoids edge cases around orphaned drafts during this narrowly scoped change.

Alternatives considered:
- Allow anonymous drafting and block only at publish time: rejected because it creates a more complex user-state model without helping the current “make it functional” goal.

## Risks / Trade-offs

- [Relaxing accepted source media could widen the backend surface] -> Mitigation: keep stored output canonical and constrain supported source formats explicitly to the product-owned draw flow.
- [Success state without gallery readback may feel incomplete] -> Mitigation: make the draw page success result explicit and link forward to later discovery surfaces without pretending the full loop is finished.
- [Route-level action wiring may duplicate some demo logic] -> Mitigation: keep the page action thin and reuse the same service/error-shaping patterns.
- [Canvas export might still fail in unusual browser states] -> Mitigation: show a local export failure and keep the current drawing intact for retry.

## Migration Plan

1. Add failing draw-route tests describing auth gating, publish success, and publish failure behavior.
2. Introduce the draw-route server contract and reuse the backend publish service.
3. Update the product draw page to export canvas media, submit through the route action, and show success/failure states.
4. Extend publish capability specs and browser journeys to reflect the real product flow.
5. Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.

Rollback:
- Remove the draw-route server action and restore the current local-only publish behavior if the real product publish flow proves unstable.
- If the backend source-media acceptance is broadened, rollback should preserve the canonical stored AVIF contract even if the product wiring is removed.

## Open Questions

- Whether successful publish should show an inline preview of the persisted artwork, or just the new artwork id/title and a clear success confirmation.
- Whether the relaxed source-media allowance should be draw-route-specific or a broader publish-contract change for all product clients.
