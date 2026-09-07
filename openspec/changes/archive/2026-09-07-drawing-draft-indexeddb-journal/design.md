## Context

Browser-local drawing drafts currently persist as whole-document editable V2
JSON strings through the helpers in `apps/web/src/lib/features/stroke-json/drafts.ts`.
That keeps the storage API simple, but it couples draft durability to repeated
full-document replacement in `localStorage`, a synchronous string-only storage
path with a tight origin budget. The studio flow also persists fork context in
`localStorage`, including the parent `drawingDocument`, which can duplicate a
large fork baseline outside the main draft record.

The repo already reduced some write amplification for large drawings through
responsive editing: large documents defer persistence until stroke commit.
However, the persisted unit is still one monolithic serialized document.
Recovering large drafts therefore still depends on one large storage write and
one large storage read succeeding repeatedly.

This change is cross-cutting because it affects artwork studio recovery, avatar
sketch recovery, fork continuation, legacy draft migration, storage-failure
handling, and the persistence abstraction shared by multiple browser surfaces.
It also introduces a new architectural pattern: operation-based draft
persistence backed by IndexedDB snapshots plus a stroke journal.

## Goals / Non-Goals

**Goals:**
- Make IndexedDB the authoritative browser-local persistence layer for artwork
  and avatar drafts.
- Replace repeated whole-document browser writes with `snapshot + stroke
  journal` persistence.
- Keep hydration bounded by periodic snapshot compaction instead of replaying an
  unbounded stroke log forever.
- Preserve exact Stroke JSON recovery semantics for committed strokes.
- Migrate recoverable legacy `localStorage` drafts without requiring a backend
  API or server migration.
- Remove duplicate fork parent document persistence from `localStorage`.
- Surface storage failures explicitly so large artwork work is not silently
  treated as durably saved when it is not.

**Non-Goals:**
- Cross-device or backend-synced draft storage.
- Replacing Stroke JSON with a bitmap or raster persistence model.
- Journal entries at pointer-move granularity.
- Adopting DuckDB WASM or OPFS as the first persistence backend for this
  change.
- Changing publish payload contracts, backend storage formats, or artwork/avatar
  API shapes.

## Decisions

### 1. IndexedDB becomes the authoritative local draft store

Draft persistence will move from `localStorage` to IndexedDB for artwork and
avatar drawing flows. `localStorage` remains acceptable for small
preference-style values, but not for large drawing documents or fork baselines.

Alternative considered: continue using `localStorage` with compression. Rejected
because it remains synchronous, string-bound, and quota-fragile. Alternative
considered: use DuckDB WASM immediately. Rejected because the workload is keyed
draft recovery, not local SQL analytics, and DuckDB would add substantial
runtime and persistence complexity before solving the simpler problem.

### 2. Draft persistence uses one materialized snapshot plus an append-only stroke journal

Each draft identity is keyed by `(surface, userKey, scope)` and stored in one
IndexedDB database. The store keeps:
- a latest materialized snapshot record containing the editable V2 document plus
  draft metadata
- append-only journal entries for committed strokes that were saved after the
  latest snapshot

Hydration reconstructs the draft by loading the snapshot and replaying later
journaled strokes in sequence.

Alternative considered: journal-only persistence. Rejected because recovery cost
would grow with the entire lifetime of a draft or fork. Alternative considered:
single-record persistence with an embedded stroke array. Rejected because it
would reintroduce large record rewrites as the journal grows.

### 3. Persistence moves to an operation-based boundary instead of diffing full documents

The persistence layer will consume explicit draft operations such as:
- hydrate seed
- stroke committed
- clear/reset
- publish success / avatar save success
- fork cancel / draft abandon

This avoids trying to infer append-only intent by diffing successive full
`DrawingDocumentV2` snapshots. It also allows the same journal model to work
for both large responsive drawings and smaller drawings whose UI path still
mutates canonical document state during active input.

Alternative considered: watch `drawingDocument` snapshots and derive appended
strokes by diffing previous and next documents. Rejected because clear/reset,
fork changes, migration, and small-surface editing flows would make that diff
logic fragile and hard to reason about.

### 4. Journal appends happen at stroke boundaries, not per point

The journal unit is one committed stroke or a small committed-stroke batch,
never one pointer move. Dense pointer input during a single stroke should not
create multiple persisted records. This keeps the journal aligned with the
canonical Stroke JSON editing unit already used by responsive editing.

Alternative considered: point-level journal entries. Rejected because the write
rate and recovery complexity would be too high for the value gained, and the
repo has already accepted stroke-boundary persistence as the right compromise
for large drawings.

### 5. Compaction rewrites a fresh snapshot and prunes journal entries transactionally

When configured journal thresholds are exceeded by count, bytes, or age, the
draft store will write a fresh snapshot of the current canonical document and
delete superseded journal entries in the same IndexedDB transaction. This keeps
hydration bounded while preserving the exact recovered document.

Alternative considered: never compact. Rejected because long-lived drafts and
forks would eventually make hydration cost grow too far. Alternative
considered: compact on every stroke commit. Rejected because it would collapse
back into frequent large snapshot rewrites.

### 6. Legacy localStorage migration is one-way, lazy, and rollback-aware

If a draft load finds no IndexedDB record for a draft identity, the app will
check the existing V2 and V1 legacy draft keys. A valid legacy payload will be
imported into the snapshot store on demand. The first rollout stops writing new
large drawing drafts to `localStorage`, but legacy keys are not eagerly removed
on import; they remain as a read-only fallback until the draft is explicitly
cleared, published, or replaced by later cleanup work.

Alternative considered: eager startup migration of every draft key. Rejected
because it adds more startup work and less control over failure handling.
Alternative considered: immediate legacy-key deletion on successful import.
Rejected because it weakens rollback options for the first rollout.

### 7. Fork continuation stores only minimal context outside the draft snapshot

Once a fork draft snapshot exists, the app no longer needs to persist the full
parent `drawingDocument` separately in `localStorage`. The snapshot already
captures the editable seed state needed for continuation. Any extra persisted
fork context should be reduced to lightweight metadata such as parent artwork
id and display fields needed for resume UX.

Alternative considered: keep the current fork-parent document duplication for
resume convenience. Rejected because it doubles large-document browser storage
cost for the exact flows that most need relief.

### 8. Storage failure handling is explicit and non-destructive

IndexedDB writes are asynchronous and can fail because of quota, privacy mode,
blocked persistence, or transaction errors. On write failure, the app must keep
the in-memory document intact, leave the previous durable snapshot untouched,
and mark the draft as not fully saved so the user is not misled about
durability.

Alternative considered: silently swallow storage errors and continue as if the
draft were safe. Rejected because the motivating product problem is silent draft
fragility on large artwork.

## Risks / Trade-offs

- [IndexedDB behavior varies across browsers and private modes] -> Feature-detect
  the store at startup, keep the in-memory editor usable, and expose explicit
  unsaved-draft status when durable storage is unavailable.
- [Operation-based persistence requires new editor integration points] -> Add a
  narrow draft-session adapter that existing surfaces call for hydration,
  stroke commits, clears, and publish/save completion instead of letting each
  component talk to IndexedDB directly.
- [Journal/schema bugs could corrupt one draft identity] -> Version the database
  schema, isolate records by draft identity, and clear only the affected draft
  on decode/replay failure instead of wiping all local draft data.
- [Compaction thresholds may be tuned poorly at first] -> Start with
  conservative thresholds and cover large-fork hydration plus long-lived draft
  cases in browser/component tests before tightening.
- [Rollback after rollout may miss post-migration strokes in an older build] ->
  Keep legacy keys readable during the first rollout and defer destructive
  legacy cleanup until confidence is higher.

## Migration Plan

1. Introduce a browser draft-store abstraction over IndexedDB with snapshot and
   journal records keyed by draft identity.
2. Add lazy legacy import from existing V2/V1 draft keys when no IndexedDB
   draft exists.
3. Change studio and avatar flows to persist through draft operations
   (`hydrate`, `stroke commit`, `clear`, `publish/save`, `fork cancel`) instead
   of whole-document `localStorage` writes.
4. Remove full fork parent document persistence from `localStorage`, keeping
   only minimal fork resume metadata if still needed.
5. Add compaction and cleanup rules so long-lived drafts do not accumulate
   unbounded journal replay cost.
6. Add unit, component, and e2e coverage for migration, exact stroke journal
   recovery, compaction, publish/save cleanup, and explicit storage-failure
   behavior.

Rollback strategy:
- Because the first rollout keeps legacy draft keys readable and avoids eager
  deletion, reverting the application code path can still recover the last
  legacy snapshot for drafts that existed before migration.
- Post-migration strokes written only to IndexedDB are not guaranteed to be
  visible to an older build. If strict rollback continuity is required later,
  that needs either a temporary compatibility mirror or a later coordinated
  cleanup/removal window.

## Open Questions

- What exact thresholds should trigger compaction: stroke count, estimated
  bytes, idle time, or a combination?
- Should lightweight fork resume metadata live inside the snapshot record or in
  a small companion store?
- Is a tiny promise-friendly IndexedDB helper desirable, or should the first
  cut stay on a narrow internal wrapper around the native API?