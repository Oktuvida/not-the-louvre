# Hot Wall Design

## Goal

Implement the Hot Wall as a specialized gallery room that clearly communicates
"rising now" behavior from the PRD while preserving the current room-based
gallery architecture.

## Why

The repository already exposes a `hot-wall` room and already requests
`sort: 'hot'` discovery data, but the current experience does not make that
state legible. In practice, the Hot Wall behaves like a generic artwork grid
with different ordering rather than a room with its own meaning.

The PRD defines `Hot` as a distinct discovery mode based on recency-weighted
score, separate from both `Recent` and `Top`. This change turns the existing
partial implementation into a room that users can understand without reading
the code.

## Current State Assessment

### Already implemented

- `hot-wall` is a valid gallery room in
  `src/lib/features/gallery-exploration/model/rooms.ts`.
- room loading already routes `hot-wall` through
  `src/routes/gallery/gallery-data.server.ts`.
- server-side discovery already calls `listArtworkDiscovery` with
  `{ sort: 'hot', limit: 12, window: null }`.
- the artwork read repository already implements the PRD hot formula using a
  gravity factor of `1.5` in
  `src/lib/server/artwork/read.repository.ts`.
- route tests already verify that `hot-wall` loads with `sort: 'hot'`.

### Missing or weakly implemented

- the Hot Wall currently renders through the generic gallery-grid branch in
  `GalleryExplorationPage.svelte`.
- the UI does not distinguish “hot right now” from “top of all time”.
- component coverage does not prove a room-specific Hot Wall presentation.
- service coverage proves ranked feed behavior generally, but does not clearly
  document the Hot Wall as a product contract.

## Scope

This slice will:

- keep the Hot Wall at `/gallery/hot-wall`
- preserve the current gallery-room architecture
- keep using discovery data from `sort: 'hot'`
- make the Hot Wall visually distinct from Hall of Fame and the generic room
  layout
- introduce tests that document the intended Hot Wall behavior at service,
  route, component, and end-to-end levels

This slice will not:

- introduce the future feed tabs `Recent / Hot / Top`
- replace the room system with a dedicated feed page
- add new pagination or infinite scroll behavior for Hot Wall
- redesign Hall of Fame, Mystery Room, or Your Studio beyond any minimal shared
  refactoring needed for maintainability

## Product Behavior

The Hot Wall should represent momentum, not historical dominance.

Compared with other rooms:

- `Hall of Fame` remains the archival, top-ranked room driven by `top`
- `Hot Wall` becomes the “currently surging” room driven by `hot`
- `Your Studio` remains the viewer-scoped personal room
- `Mystery Room` remains a shuffled exploration surface

The room should still allow users to:

- browse live product artworks
- open artwork detail from the room
- use the same NSFW gating behavior already supported by the gallery detail
  surfaces
- rely on the same detail-panel realtime behavior already wired into artwork
  detail

## Recommended Approach

Keep the backend topology as-is and specialize the Hot Wall at the room
contract and presentation layers.

This is the best tradeoff because:

- the current hot ranking formula already matches the PRD closely enough to be
  a stable base
- the largest gap is semantic clarity, not missing infrastructure
- the room can become product-meaningful without prematurely building the full
  future feed architecture

## Backend And Data Contract

### Discovery semantics

The repository should continue to derive hot ranking using the existing
recency-weighted formula:

`score / (hours_since_publish + 2)^1.5`

The design intent is not to replace that formula, but to make it explicit and
tested as Hot Wall behavior.

### Load path

`src/routes/gallery/gallery-data.server.ts` should remain the single load path
for gallery rooms.

For `hot-wall`, it should continue to:

- request `sort: 'hot'`
- limit results to the room-sized slice
- return the same core artwork records used elsewhere in gallery exploration

If the Hot Wall UI needs presentation metadata, that metadata should be derived
server-side in this load path rather than recreated ad hoc inside the component.

Examples of acceptable presentation metadata:

- `featuredArtworkId`
- `hotWallLeadIndex`
- copy or labels specific to the room

This design does not require new persisted database fields.

## UI Design

### Visual direction

The Hot Wall should feel alive rather than ceremonial.

It should visually communicate:

- one leading piece that is hot right now
- a surrounding set of contenders or risers
- stronger heat/momentum language than the neutral gallery grid

It should avoid:

- podium metaphors that belong to Hall of Fame
- archival or trophy-room language
- looking identical to the default room branch with only different sort order

### Layout

In `GalleryExplorationPage.svelte`, add a dedicated `roomId === 'hot-wall'`
branch.

That branch should:

- render a lead artwork with stronger prominence
- render remaining artworks in a supporting wall layout
- preserve existing card-to-detail affordances
- continue to support NSFW blur/reveal behavior

The lead artwork does not need a different underlying data type. It can be the
first item in the hot-ranked set unless later tests show the room needs a more
specific selection rule.

### Copy

Room copy should emphasize heat and momentum.

Examples of acceptable phrasing:

- “fresh pieces rising fast through the current gallery heat”
- “hot right now”
- “climbing now”

It should avoid claims that imply historical best-of ranking.

### Empty state

The Hot Wall empty state should be more specific than the current generic room
message.

Instead of implying the room has no winners yet, it should communicate that no
pieces are currently surging into the Hot Wall.

## Testing Strategy

### Service tests

Add or tighten tests in `src/lib/server/artwork/read.service.test.ts` to prove:

- hot ranking remains distinct from top ranking
- recency can outrank older score under the hot formula
- hidden or deleted content still respects existing visibility rules in hot
  discovery

The goal is not exhaustive math verification but a product-readable contract for
the room’s ranking semantics.

### Route tests

Keep route tests in `src/routes/gallery/[room]/page.server.test.ts` and extend
them only as needed to prove that the Hot Wall room still loads from hot
discovery and returns the shape required by its specialized UI.

### Component tests

Add Hot Wall-specific coverage in
`src/lib/features/gallery-exploration/GalleryExplorationPage.svelte.spec.ts` to
verify:

- the specialized Hot Wall branch renders instead of the generic grid branch
- the lead artwork is visibly promoted
- supporting artworks still render and remain interactive
- the Hot Wall empty state copy renders correctly

### End-to-end test

Add one focused Playwright assertion in `src/routes/not-the-louvre.e2e.ts` that
visits `/gallery/hot-wall` and confirms the specialized room renders without
breaking artwork selection and detail opening.

The e2e should stay narrow. It does not need to prove the ranking formula in a
browser.

## Risks And Mitigations

### Risk: the UI overfits to fake “heat” signals

Mitigation:

- do not invent client-side trend metrics in this slice
- keep the lead artwork selection tied to the actual ranked result order

### Risk: the Hot Wall drifts toward the future feed architecture

Mitigation:

- keep the route and room model unchanged
- avoid tabs, new pagination patterns, or feed-level abstractions here

### Risk: duplicated layout logic increases maintenance cost

Mitigation:

- reuse existing artwork cards where possible
- extract only small shared helpers if the new branch would otherwise repeat
  substantial existing markup

## Implementation Notes

- Treat the ranking implementation as mostly present and the room contract as
  partially present.
- Prioritize test-first work: add failing coverage for the Hot Wall-specific UI
  and any ranking semantics that are currently under-documented.
- Keep changes focused on the Hot Wall slice only.
- Do not expand the scope into the full PRD feed-tab system.
