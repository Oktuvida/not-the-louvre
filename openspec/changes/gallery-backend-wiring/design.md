## Context

The app can now create real artworks, but the gallery product routes still render a fully mocked client model from `apps/web/src/lib/features/gallery-exploration/fixtures/artworks.ts`. `apps/web/src/routes/gallery/+page.svelte` and `apps/web/src/routes/gallery/[room]/+page.svelte` simply pass a room id into a fixture-backed page, so newly published artwork never appears in the gallery even though the backend discovery services already exist.

There is already a backend read surface for this domain: artwork discovery and detail are available through `apps/web/src/lib/server/artwork/read.service.ts` and the related API routes. The demo routes prove those contracts work. The gap is therefore product route wiring, frontend model translation, and deciding how the current room concepts map onto the real discovery capabilities.

The main product constraint is that the current room taxonomy (`hall-of-fame`, `hot-wall`, `mystery`, `your-studio`) is more expressive than the backend discovery contract today. The backend already supports recent/hot/top discovery and detail, but not necessarily every room as a first-class backend concept. Because the user wants function first, this change should map rooms onto the existing discovery primitives rather than invent a larger ranking or personalization system.

## Goals / Non-Goals

**Goals:**
- Make `/gallery` and gallery room routes load real persisted artwork data from the backend.
- Replace fixture-only artwork cards and detail panels with translated real discovery/detail models.
- Support meaningful empty and failure states so gallery routes remain usable even when there is little or no data.
- Keep room navigation working by mapping the current room model onto existing backend discovery capabilities.
- Add route, component, and browser coverage that proves newly published artwork can be rediscovered in the product gallery.

**Non-Goals:**
- Reworking the visual design of the gallery experience.
- Designing new ranking algorithms, moderation surfacing, or recommendation logic.
- Implementing full realtime gallery updates in this change.
- Solving the full social layer (comments, votes, moderation interactions) beyond read-only display if not already present.

## Decisions

### 1. Add server loads to gallery routes instead of doing client-side fetch-first discovery

`/gallery` and `/gallery/[room]` should move to SvelteKit server loads that call the existing artwork read services. The gallery page then receives already-shaped data at render time, which keeps the product path consistent with the rest of the app’s route-owned server contracts.

Why this decision:
- It matches the route pattern already used in auth and draw publishing.
- It gives the gallery route one place to translate backend discovery results into the frontend gallery model.
- It avoids booting the gallery on empty fixtures and then rehydrating from the network later.

Alternatives considered:
- Fetch discovery data only in the browser: rejected because it delays the first useful render and duplicates route concerns inside components.

### 2. Map existing room ids onto current discovery modes instead of inventing new backend room primitives now

The product room model should be treated as a presentation layer over current discovery capabilities. For example: `hall-of-fame` can map to `top`, `hot-wall` to `hot`, `your-studio` to recent works by the current user if available or a constrained recent filter, and `mystery` can operate on a real recent/hot pool rather than fixture data.

Why this decision:
- It keeps the change functional and small.
- It lets the product keep its current room navigation without blocking on larger backend taxonomy work.
- It gets real artworks into the gallery fast.

Alternatives considered:
- Introduce dedicated backend room entities first: rejected because it is more product invention than wiring.
- Remove room concepts entirely: rejected because it would create unnecessary product churn.

### 3. Add a gallery model adapter instead of leaking backend read types directly into presentation components

The current `Artwork` view model used by `ArtworkCard` and `ArtworkDetailPanel` does not match the backend read shapes. A translation layer should map discovery/detail responses into the gallery presentation model, including image/media URL, author display fields, timestamps, and any temporary derived values needed for the existing UI.

Why this decision:
- It keeps presentation components decoupled from backend schema details.
- It allows incremental cleanup later if the gallery UI changes.
- It avoids rewriting every gallery component around raw server types in this one change.

Alternatives considered:
- Replace the current gallery presentation model wholesale with backend types: rejected because it would broaden scope and create noisier UI refactors than necessary.

### 4. Treat empty and unavailable discovery states as first-class product behavior

Because this is the first time real content will appear, the gallery must gracefully handle cases where there are no artworks yet, where a room has no applicable content, or where detail lookup for a selected artwork fails. The product should show clear empty-state messaging rather than falling back to fake content.

Why this decision:
- Real data inevitably means sparse data.
- Without empty states, removing fixtures can make the app feel broken instead of honest.
- This is essential for a functional-first milestone.

Alternatives considered:
- Keep fixtures as fallback when the backend is empty: rejected because it hides the real system state and makes debugging/product truth harder.

### 5. Keep the first gallery detail experience read-only if necessary to avoid coupling on unfinished interaction flows

The gallery should support opening real artwork detail, but it does not need to become the full interaction surface in this change if comments/votes are not fully productized yet. The main requirement is that real artworks are discoverable and inspectable.

Why this decision:
- It protects scope.
- It keeps the next milestone focused on browseability after publish.
- It avoids forcing unfinished social actions into the same change.

Alternatives considered:
- Bundle full voting/commenting into this change: rejected because it turns a read wiring task into a much larger social product task.

## Risks / Trade-offs

- [Current room concepts may not map cleanly onto backend discovery modes] -> Mitigation: document a simple deterministic mapping now and revisit richer room semantics later.
- [Existing gallery components may assume fixture-only fields] -> Mitigation: add a focused adapter layer rather than leaking backend types directly into UI code.
- [Removing fixtures may reveal empty content more often than expected] -> Mitigation: provide explicit empty-state messaging and keep publish-to-gallery verification in tests.
- [Real detail reads may surface backend errors the fixture UI never had] -> Mitigation: route-level error handling and safe selection/reset behavior in the page model.

## Migration Plan

1. Add failing gallery route and component tests that describe real discovery data, room mapping, and empty-state behavior.
2. Add server loads for `/gallery` and `/gallery/[room]` that call existing artwork read services.
3. Introduce a frontend adapter from backend discovery/detail models into the current gallery presentation model.
4. Replace fixture reads with real route data while preserving room navigation and artwork selection behavior.
5. Add browser coverage proving a newly published artwork appears in the product gallery.
6. Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.

Rollback:
- Restore fixture-backed gallery pages if the real product gallery becomes unstable.
- Keep backend discovery contracts untouched, since this change is primarily route/UI wiring.

## Open Questions

- Whether `your-studio` should be truly user-specific now or remain a simpler recent/self-authored hybrid until profile/gallery ownership views are better defined.
- Whether artwork detail in the product gallery should immediately include real comments/votes, or stay read-focused until a later social wiring change.
