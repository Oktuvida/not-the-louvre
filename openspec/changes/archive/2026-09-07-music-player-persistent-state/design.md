## Context

The ambient audio controller already has a backend-backed enabled/disabled preference path, but the current initialization logic resolves `bootstrappedPreference ?? storedPreference ?? true`, which means a visitor with no prior preference starts with audio on. The controller also always initializes the playlist at index `0` and never stores which track the listener last reached. The result is that the experience is intrusive on first visit and loses lightweight continuity across reloads.

This change should stay small. The request is to remember the song, not the exact playback second. The backend should remain authoritative for whether ambient audio is enabled when a signed-in viewer has a saved preference, while track continuity can remain a local client concern.

## Goals / Non-Goals

**Goals:**
- Initialize ambient audio as off when no prior preference exists.
- Restore the last selected track across reloads.
- Preserve backend canonical behavior for enabled or disabled preference when a signed-in viewer is present.
- Avoid introducing exact playback-position persistence.
- Cover initialization and reload behavior with automated tests.

**Non-Goals:**
- Persisting playback timestamps.
- Adding new backend storage for per-track progress.
- Redesigning the audio affordance UI.
- Changing playlist content or audio asset delivery.

## Decisions

### 1. Default to off when both backend and local preference are absent

The initial preference resolver should treat “no known preference” as disabled. That aligns the first-visit behavior with explicit opt-in rather than autoplay.

Why this decision:
- The user explicitly called out autoplay as intrusive.
- The existing backend contract already supports an explicit boolean preference, so “unknown” can map safely to off.

Alternatives considered:
- Keep the current default-on fallback: rejected because it preserves the intrusive first-visit behavior the bug report wants removed.

### 2. Persist track identity locally rather than a bare numeric index

Ambient audio should store the current track's stable identifier locally and resolve it back to the active playlist on mount. If the saved track no longer exists, the controller falls back to the default available track.

Why this decision:
- The user cares about returning to the same song, not the same array index.
- Track identity is more resilient if the playlist order changes.

Alternatives considered:
- Persist only the numeric index: rejected because it is more fragile if the playlist is reordered.
- Persist the current track in backend preferences: rejected because it expands scope beyond the requested minimum persistence.

### 3. Keep backend on/off canonical and track continuity local

Signed-in users should continue to sync enabled or disabled state through the existing viewer content-preferences backend. Track identity remains a local hint layered on top of that preference. If backend says audio is off, the controller stays off but still remembers which track to use the next time playback is enabled.

Why this decision:
- It respects the existing backend contract without requiring schema changes.
- It keeps this bug fix narrow while still giving the listener continuity.

Alternatives considered:
- Merge on/off and current-track state into one local-only preference: rejected because it would weaken the existing backend-backed preference model.

## Risks / Trade-offs

- [Saved track identity may no longer exist in a later playlist] -> Mitigation: resolve by track ID and fall back safely to the first available track.
- [Local storage may be unavailable in privacy-constrained environments] -> Mitigation: keep the controller functional without local persistence and treat missing storage as a best-effort limitation.
- [Backend and local state could disagree] -> Mitigation: let backend win for enabled or disabled state and use local track identity only as the next-track hint.

## Migration Plan

1. Add failing preference and controller tests for first-visit default off and last-track restoration.
2. Extend local ambient-audio preference helpers to store a stable current-track identifier alongside the existing on/off storage.
3. Update the controller to resolve backend canonical on/off first, then restore the local track hint.
4. Validate with `bun run format`, `bun run lint`, `bun run check`, and `bun run test` during implementation.

## Open Questions

None. The approved scope is explicit about minimum persistence and backend authority boundaries.