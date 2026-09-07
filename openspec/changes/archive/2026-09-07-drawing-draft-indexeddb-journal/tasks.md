## 1. IndexedDB draft-store foundation

- [x] 1.1 Add failing unit tests for draft identity keys, snapshot hydration, stroke-journal replay, clear semantics, and per-draft isolation.
- [x] 1.2 Implement the IndexedDB schema and adapter for snapshot plus journal persistence behind the existing stroke-json draft boundary.
- [x] 1.3 Add a draft-session API that exposes hydrate, append committed stroke, compact, and clear operations without leaking raw IndexedDB calls into editor surfaces.

## 2. Legacy migration and draft lifecycle

- [x] 2.1 Add failing tests for lazy import from legacy V2 and V1 localStorage draft keys, including invalid-payload handling.
- [x] 2.2 Implement one-way lazy migration on first IndexedDB miss and stop writing large drawing drafts back to localStorage.
- [x] 2.3 Remove full fork parent drawing-document persistence from localStorage and keep only the lightweight fork-resume metadata still required by the UX.
- [x] 2.4 Wire artwork publish, avatar save, and explicit draft-abandon flows to clear the persisted snapshot, journal, and related resume metadata for the affected draft identity.

## 3. Editor operation integration

- [x] 3.1 Add failing component tests proving artwork and avatar flows persist one journal append per committed stroke and do not persist intermediate pointer moves as separate journal writes.
- [x] 3.2 Extend the studio canvas and avatar sketch editing paths to emit the stroke-commit and lifecycle operations required by the draft-session API.
- [x] 3.3 Update studio and avatar consumers to hydrate from IndexedDB-backed draft sessions instead of whole-document localStorage persistence helpers.

## 4. Compaction and failure handling

- [x] 4.1 Add failing tests for snapshot compaction equivalence, transactional journal pruning, and corrupted-draft isolation.
- [x] 4.2 Implement threshold-based compaction that rewrites a fresh snapshot and removes only superseded journal entries for that draft identity.
- [x] 4.3 Surface explicit unsaved-draft status when IndexedDB writes fail while preserving the in-memory drawing and the last durably persisted draft state.

## 5. Verification

- [x] 5.1 Add browser and e2e coverage for legacy migration, fork resume, publish/save cleanup, and large-draft recovery after reload.
- [x] 5.2 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, then fix any regressions introduced by this change.