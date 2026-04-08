## Context

The draw route now supports real fork publishing, but `StudioDrawingPage.svelte` still treats `initialDrawingDocument` as the reset baseline after publish success. In fork mode that initial baseline is the inherited parent artwork, so clearing the canvas after a successful publish removes only the user's new work and leaves the original fork seed behind. The same page also persists fork parent context and fork-scoped drafts, which means a partial reset can rehydrate the old fork state on draw-again or reload.

This change is intentionally narrow. The backend publish contract is already working; the problem is client-side post-publish state cleanup. The fix must preserve the current non-fork success state, keep retry behavior intact on failure, and make fork publish completion behave like the end of fork mode.

## Goals / Non-Goals

**Goals:**
- Exit fork mode completely after a successful fork publish.
- Reset the active draw baseline to a new empty artwork rather than the fork seed.
- Clear fork-scoped persistence so reload does not revive the old parent.
- Keep non-fork publish success and failure behavior unchanged.
- Cover the behavior with component and browser tests.

**Non-Goals:**
- Changing backend artwork publishing behavior.
- Redesigning the draw success UI.
- Altering how fork hydration works before publish.
- Refactoring unrelated draw-route state.

## Decisions

### 1. Treat successful fork publish as an exit from fork mode

After a successful publish that includes a parent artwork context, the page should clear fork persistence, set `currentForkParent` to `null`, replace the initial baseline with a new empty document, and then reset the active document from that empty baseline.

Why this decision:
- The user expectation is that fork publish finishes the fork and starts fresh.
- It prevents reload and draw-again from using stale fork context.
- It fixes the root cause instead of only hiding the inherited drawing for one frame.

Alternatives considered:
- Reset only `drawingDocument` and leave fork baseline state intact: rejected because the old parent would still return on later resets or hydration.

### 2. Reuse one explicit helper for fork cleanup

Successful fork publish and any later “draw again from this success state” path should reuse the same empty-state reset helper instead of duplicating logic inline. The helper should only apply the fork-specific cleanup when a parent artwork context exists.

Why this decision:
- It keeps successful fork cleanup and later reset actions aligned.
- It lowers the risk that one path clears draft storage while another forgets to clear the parent or baseline.

Alternatives considered:
- Duplicate publish-success cleanup inline and rely on manual parity with the draw-again path: rejected because this bug already comes from divergent reset assumptions.

### 3. Preserve non-fork success behavior by gating on parent context

The new empty-state reset logic should activate only for successful publish flows that are currently in fork mode. Non-fork success still follows the existing draw-route success contract.

Why this decision:
- The bug report is specific to forks.
- Non-fork publish already ends in a clear enough local success state.

Alternatives considered:
- Force the same reset flow for every publish success: rejected because it broadens scope and risks unnecessary behavior changes.

## Risks / Trade-offs

- [Fork cleanup may accidentally clear state needed by the current success UI] -> Mitigation: keep the published-artwork success payload separate from the editing baseline reset.
- [Draw-again could still reference stale persistence keys] -> Mitigation: route every fork-success reset through the same helper that clears fork parent storage and fork-scoped drafts.
- [Tests may miss reload-time regressions] -> Mitigation: include browser coverage that reloads after successful fork publish.

## Migration Plan

1. Add failing coverage for successful fork publish reset and reload behavior.
2. Introduce a dedicated helper that returns the draw route to empty new-artwork mode and clears fork persistence.
3. Use that helper after successful fork publish while keeping failure behavior untouched.
4. Validate with `bun run format`, `bun run lint`, `bun run check`, and `bun run test` during implementation.

## Open Questions

None. The desired post-publish fork behavior is fully defined.