# Stroke JSON V2 End-to-End Adoption

**Date:** 2026-04-03
**Status:** Proposed

## Context

The stroke-json work already introduced `DrawingDocumentV2` as the canonical
format for lossless compaction research and for persisted compressed payloads in
shared storage helpers.

However, the product flow is still split across versions.

- The backend can persist canonical V2 payloads.
- The server-load paths that hydrate the editor still flatten those payloads to
  V1 before returning them to the frontend.
- The drawing editors and browser drafts still work with `DrawingDocumentV1`.
- The current lossless compactor assumes a full rewrite to `base` and clears
  `tail`, which does not preserve enough recent history for straightforward
  undo/redo-oriented editing after publish.

The desired product direction is now explicit:

- the frontend should work natively in V2
- the backend should deliver V2 to the frontend
- compatibility with V1 must remain at read boundaries
- publish should compact on the client, not on the server
- publish compaction must preserve a recent editable suffix by keeping at least
  1000 points in `tail`, counted by complete strokes only

This design supersedes the earlier direction that treated storage-time backend
compression as the primary place where product compaction policy should live.

## Decision

Adopt `DrawingDocumentV2` end to end for all editable product flows.

- The backend delivers V2 documents to the frontend.
- The frontend editor state and local drafts use V2 natively.
- New drawing work is appended only to `tail` during editing.
- Publish prepares the outgoing payload on the client by compacting only the
  eligible prefix of the document.
- The publish compaction policy keeps a protected `tail` suffix containing the
  minimum ordered set of complete strokes whose combined point count is at least
  1000.
- The backend validates format and limits, renders media, and persists the
  submitted V2 structure without reapplying product compaction policy.

## Goals

- Eliminate the current V2-on-write and V1-on-edit split.
- Make V2 the editable contract for studio and avatar flows.
- Preserve compatibility with legacy V1 payloads and V1 local drafts.
- Keep client publish payloads smaller and more scalable by compacting before
  network transfer.
- Preserve a recent editable suffix so future undo/redo and iterative editing
  can operate on recent strokes without reconstructing history from a fully
  flattened base.
- Keep backend responsibilities focused on validation, rendering, and storage.

## Non-Goals

- Rebalancing `base` and `tail` when an existing V2 document is merely loaded
  into the editor.
- Compacting continuously while the user is drawing.
- Enforcing the 1000-point tail heuristic inside backend persistence code.
- Rejecting otherwise valid V2 payloads only because they were not compacted by
  the preferred client heuristic.
- Redesigning the raster-guard presets or the exact occlusion oracle itself.

## Document Contract

## Canonical Editable Format

`DrawingDocumentV2` becomes the product-owned editable format for both studio
and avatar experiences.

- The editor receives V2.
- The editor stores V2 in memory.
- The editor saves V2 drafts locally.
- The publish payload is V2.
- Persisted compressed source remains canonical V2.

V1 remains supported only as a compatibility input format.

## Compatibility Semantics

When the system receives a V1 document at any read boundary, it converts it to
V2 safely.

The safe conversion rule is:

- `base = []`
- `tail = original V1 strokes in original order`

This rule intentionally differs from the earlier normalization used by the
research compactor, where V1 could be mapped into `base`. For product editing,
the priority is to preserve the full incoming legacy document as recent editable
history.

When the system receives a V2 document, it preserves the exact `base` and
`tail` structure as supplied.

The product must not rebalance an existing V2 document on load merely to grow
`tail` to the 1000-point minimum. That heuristic applies only during client
publish preparation.

## Backend-to-Frontend Delivery

Server-load paths that currently decode persisted payloads and flatten them to
V1 must instead decode and return V2.

This applies in particular to:

- avatar hydration paths
- studio fork hydration paths
- any future editable source delivery path that returns a drawing document to a
  browser editor

The frontend should no longer receive a flattened V1 view unless a dedicated
legacy-only consumer explicitly requires it.

## Frontend Editing Model

## Editing Semantics

The editor renders `base` followed by `tail`, but it only mutates `tail` during
normal drawing operations.

- New strokes are appended to `tail`.
- Existing `base` strokes are treated as stable history for the session.
- Clearing or resetting the editor restores the full V2 baseline snapshot that
  was loaded for the session.

The editor is not responsible for opportunistic compaction while drawing.
Compaction remains a deliberate publish-time preparation step.

## Drafts

Browser drafts move from V1 to V2.

The draft system should support this migration path:

1. look for a V2 draft first
2. if no V2 draft exists, look for a legacy V1 draft
3. if a V1 draft exists, convert it safely to V2 with all strokes in `tail`
4. immediately rewrite the draft in V2 form during that same successful load
  path so subsequent loads stay in the new format

The draft key version should change accordingly so the browser no longer treats
V2 drafts as interchangeable with old V1 entries.

## Publish Preparation On The Client

## Responsibility Boundary

Publish compaction belongs on the client.

This is a deliberate product choice.

- It lowers payload size before network transfer.
- It reduces server work for large drawings.
- It directly benefits clients trying to publish more elaborate drawings.

The client-side publish helper should live in the shared stroke-json layer so it
can be reused by both artwork publish and avatar save flows, but it is invoked
by the frontend before making the network request.

## Protected Tail Heuristic

The publish helper must preserve a recent suffix of complete strokes whose total
point count is at least 1000.

Important details:

- The rule is a minimum, not an exact target.
- The count is measured using complete strokes only.
- The algorithm must never split a stroke merely to hit exactly 1000 points.

Examples:

1. A document with 800 total points keeps all 800 points in `tail` and leaves
   `base` empty.
2. A document with 15000 total points protects the smallest ordered suffix of
   complete strokes whose total point count is at least 1000, and only the
   earlier prefix becomes eligible for compaction.

## Tail Selection Algorithm

The publish helper computes the protected tail over the document's full ordered
stroke sequence, not only over the incoming `tail` array.

Algorithm:

1. normalize the input to V2 and apply exact stroke normalization to the full
  ordered stroke sequence before any tail-selection or compaction decisions
2. form `orderedStrokes = [...base, ...tail]`
3. traverse `orderedStrokes` from the end toward the beginning
4. accumulate `stroke.points.length`
5. stop once the accumulated count is greater than or equal to 1000, or once
   all strokes have been included
6. the resulting suffix becomes the protected publish `tail`
7. everything before that suffix becomes the publish prefix eligible for
   compaction

This approach intentionally allows the publish step to pull recent strokes back
out of `base` if needed to satisfy the minimum recent-history rule.

## Prefix Compaction

Only the prefix before the protected tail is eligible for exact lossless
compaction.

That eligible prefix is taken from the already exact-normalized ordered stroke
sequence described above.

That prefix is compacted with the selected raster-guard preset, currently using
the same safe preset vocabulary already established in the stroke-json work.

The allowed preset vocabulary is:

- `canonical`
- `conservative`
- `veryConservative`

The shared client publish helper should default to `veryConservative` unless a
caller explicitly overrides it for a research or future product need.

The resulting publish-ready document is:

- `base = compacted protected-prefix result`
- `tail = protected recent suffix`

The protected tail is preserved structurally, apart from exact stroke
normalization that does not change replay semantics.

For this design, exact stroke normalization means only the same exact
intra-stroke cleanup already allowed by the shared compaction core:

- remove consecutive duplicate points
- collapse strictly collinear interior points when that removal is exact
- preserve endpoints and preserve single-point strokes as dots

No approximate simplification, tolerance-based reduction, or stroke splitting is
allowed inside the protected tail.

The compacted prefix result in `base` is also expected to remain in this
exact-normalized form. There is no second divergent normalization policy for
`base`; both sides of the publish-ready document share the same exact
point-cleanup preconditions before the prefix-only occlusion compactor runs.

## Backend Behavior

Once the client sends the prepared V2 payload, the backend should not reapply
the product compaction heuristic.

Backend responsibilities are:

- parse and validate the submitted drawing document
- ensure kind and aggregate size limits are respected
- render derived media from the complete document
- persist the canonical serialized V2 payload

If a user manually submits a V2 document whose `base` is unusually large but the
payload still satisfies all backend limits, the backend accepts it. That is an
explicit tradeoff in favor of keeping the backend focused on format and size
validation rather than policy enforcement for client optimization.

If the backend receives a legacy V1 payload, it still normalizes it to V2 for
storage compatibility, but it does not try to impose the client publish
heuristic retroactively.

## Storage And Compression Boundary

The shared storage helper should now be treated as a canonical compression and
validation layer, not as the owner of product compaction policy.

That means:

- canonical V2 serialization still belongs there
- byte-budget enforcement still belongs there
- gzip/base64 encoding still belongs there
- product-specific compaction defaults should not be imposed there by default

The client publish helper becomes the owner of the product policy:

- selected raster guard preset
- minimum protected tail points
- prefix-only compaction before submission

## Testing Strategy

## Unit Coverage

Add focused tests for the new client publish preparation helper.

Required cases:

- empty documents remain valid and keep an empty `tail`
- single-stroke or otherwise minimal documents below 1000 total points keep all
  points in `tail`
- total point count below 1000 keeps all strokes in `tail`
- total point count above 1000 keeps the minimal complete-stroke suffix whose
  total is at least 1000
- when the incoming `tail` is too small, the protected suffix can include
  strokes originally stored in `base`
- prefix compaction changes only the eligible prefix and leaves the protected
  tail intact
- V1 input converts to V2 with all legacy strokes placed in `tail`

## Frontend Coverage

Update studio and avatar tests to prove:

- editor state is V2
- new strokes are appended to `tail`
- browser drafts persist V2
- legacy V1 drafts migrate safely to V2
- publish payload creation uses the client preparation helper before request
  submission

## Server-Load Coverage

Update server-load tests so editable hydration paths prove that:

- avatars are delivered to the frontend as V2
- fork parent drawing documents are delivered to the frontend as V2
- legacy persisted V1 payloads still decode into valid V2 editor state

## Backend Coverage

Update backend tests so they verify:

- V2 payloads are persisted without server-side rebalance of `base` and `tail`
- V1 uploads remain accepted and are normalized to V2 for persistence
- backend limit enforcement still rejects oversized payloads regardless of
  version

## Risks And Mitigations

### Risk: Tail Heuristic Surprises Existing V2 Documents

If an existing V2 payload has a small `tail`, a client publish can legitimately
pull recent strokes from `base` back into the protected tail.

Mitigation:

- make this behavior explicit in the publish helper contract
- scope it only to publish preparation, never to plain load or edit hydration

### Risk: Divergent Client Implementations

If studio and avatar each implement publish preparation separately, they can
drift.

Mitigation:

- keep the publish preparation logic in a shared stroke-json helper
- make both frontend flows call the same helper

### Risk: Backend And Client Responsibilities Blur Again

If storage helpers continue to apply implicit compaction policy, the system
reintroduces split ownership.

Mitigation:

- keep product compaction policy at the client publish boundary
- keep storage helpers limited to canonical serialization, compression, and
  limits

## Rollout

The change should roll out in this order:

1. deliver V2 from backend editable hydration paths
2. migrate editor state and local drafts to V2
3. add the shared client publish preparation helper with protected-tail logic
4. route avatar and artwork publish flows through the client helper
5. simplify backend storage boundaries so product compaction policy is no longer
   imposed there by default

At the end of this rollout, the editable product path becomes consistently V2
from server hydration to browser draft to publish payload to persisted source.