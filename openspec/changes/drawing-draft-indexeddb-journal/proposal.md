## Why

Large artwork drafts currently depend on full-document JSON snapshots stored in
browser local storage. That approach is fragile for large documents because it
rewrites the entire draft payload, stays bound to string-only storage limits,
and can duplicate large fork context in the same origin storage budget.

The product already proved that large drawings need a more careful hot path.
The next gap is durability: draft recovery should remain reliable for large
artworks and large forks without depending on repeated whole-document
replacement in `localStorage`.

## What Changes

- Introduce browser-local draft persistence backed by IndexedDB for artwork and
  avatar drawing flows.
- Replace full-document local-storage draft rewrites with a snapshot plus
  append-only stroke journal model.
- Hydrate drafts by reading the latest stored snapshot and replaying persisted
  journal strokes instead of depending on one monolithic persisted JSON value.
- Add draft compaction rules so the system periodically rolls journaled strokes
  into a new snapshot and bounds recovery cost over time.
- Migrate recoverable existing local draft entries into the new IndexedDB store
  and retire large drawing-document persistence from `localStorage`.
- Keep small preference-style browser storage in `localStorage` where
  appropriate, but remove drawing-document persistence and fork-document
  duplication from that storage path.
- Add coverage for hydration, journal append semantics, crash-safe recovery,
  migration from legacy draft keys, and quota/error handling at the browser
  storage boundary.

## Capabilities

### New Capabilities
- `drawing-draft-persistence`: browser-local artwork and avatar draft recovery
  backed by IndexedDB snapshots and stroke journals instead of whole-document
  local-storage payloads.

### Modified Capabilities

None.

## Impact

- Affected code: `apps/web/src/lib/features/stroke-json/drafts.ts`,
  `apps/web/src/lib/features/studio-drawing/StudioDrawingPage.svelte`,
  `apps/web/src/lib/features/home-entry-scene/components/AvatarSketchpad.svelte`,
  responsive drawing call sites, fork-context persistence, and related browser,
  component, and e2e tests.
- Affected systems: browser-local draft persistence, large fork continuation,
  avatar sketch recovery, artwork studio recovery, and legacy local draft
  migration.
- Affected dependencies: IndexedDB browser APIs or a thin wrapper around them;
  no backend API change is required for the first cut.