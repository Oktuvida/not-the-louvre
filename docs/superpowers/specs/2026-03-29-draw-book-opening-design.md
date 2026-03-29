# Draw Book Opening Experience

**Date:** 2026-03-29
**Status:** Proposed

## Problem

The current `/draw` route immediately drops the player into the full studio UI. That works functionally, but it misses the stronger game-like entrance the team wants: the route should begin with a closed book, animate open, and only then reveal an empty page that becomes the drawing surface with the studio tools around it.

The `demos/2d-book-anim` folder is useful as reference for the feel of a book opening, but it is not a viable implementation path for production. The demo depends on jQuery and `turn.js`, while the real app is a SvelteKit feature with tests around the current studio flow. The design therefore needs to preserve the existing publishing behavior while replacing the visual shell with a native Svelte implementation.

## Design

### Experience Goal

Entering `/draw` should feel like opening a sketchbook inside the game world:

1. The route loads with a closed book centered on screen.
2. The player clicks or taps the cover to begin.
3. The cover animates open with a short staged transition.
4. A blank page is revealed and becomes the active drawing canvas.
5. The artwork details panel and drawing tools appear only after the opening finishes.

The opening sequence is a one-time entry ritual for the page. Clearing a drawing or publishing an artwork does not close the book again.

### Scene State Model

`StudioDrawingPage.svelte` becomes the scene orchestrator for three explicit UI states:

- `closed` — only the book shell is visually active; the canvas and tool UI are hidden or inert.
- `opening` — the book animates from closed to open; the canvas may already be mounted for layout stability but must not accept input.
- `open` — the canvas is interactive and the rest of the studio UI is visible.

This state machine stays local to the page component. No server contract or route data shape changes are required.

The transition from `opening` to `open` should be driven by a single explicit completion signal owned by the book-stage component, so UI behavior and tests agree on the exact moment the canvas and controls unlock.

### Native Svelte Book Shell

Create a book-stage component in the studio feature that reproduces the idea of the reference demo without reusing its libraries:

- A rigid front cover that visually reads as a game-world sketchbook.
- An inner spread with a left page and a right page.
- A CSS 3D hinge/opening animation driven by Svelte state and class changes.
- A blank right-hand page sized to host the existing drawing canvas.

The book stays on screen after opening. This is not an intro overlay that disappears; it becomes the real container for the drawing experience.

### Canvas Integration

`DrawingCanvas.svelte` remains the real drawing surface and keeps its export/publish responsibilities unchanged. The main changes are compositional:

- Render the canvas inside the right page of the opened book.
- Add a simple interaction gate such as `interactive` or `disabled` so pointer input is ignored until the scene reaches `open`.
- Keep the blank paper background in the canvas so the visible drawing surface still exports as a clean sheet.

Mounting the canvas through the opening sequence is preferred over conditionally creating it after the animation. That avoids extra lifecycle complexity around the 2D context and keeps testing deterministic.

### Tool and Metadata Reveal

The title field, NSFW toggle, publish controls, and drawing tool tray remain outside the book rather than being crammed into the page itself.

- In `closed` and `opening`, these controls are visually hidden and removed from pointer/focus interaction.
- In `open`, they fade or slide in after the cover animation completes.
- The book remains the primary focal point; the controls are secondary supporting UI.

The current publishing logic, moderation checks, and success/error states stay intact.

### Layout Direction

Desktop layout centers the open book as the main stage, with the tool tray and artwork details positioned around it once available.

- The book should dominate the viewport.
- The right page should clearly read as the active drawing page.
- The left page can stay decorative or lightly contextual, but it should not introduce new product requirements.

On smaller screens, the book scales down and the surrounding controls can stack beneath it. The defining behavior is preserved: closed book first, open book second, interactive page last.

### Interaction Rules

- Clicking or tapping the closed cover starts the opening animation.
- While opening, drawing input is blocked and the publish/clear actions are unavailable.
- When the animation ends, the page enters `open` and normal drawing begins.
- If the player revisits `/draw`, the same opening sequence runs again on initial load.

No skip control is required in this change unless implementation friction reveals a concrete accessibility need.

### Accessibility and Motion Constraints

The opening interaction must still expose a clear actionable element for keyboard and assistive technology users. The closed cover should therefore behave like a button, with an accessible label describing that it opens the sketchbook.

For reduced-motion users, the experience should preserve the same state progression but shorten or simplify the transition instead of relying on a long 3D animation. The expected fallback is a near-instant or very short open transition that still moves through `closed -> opening -> open` without extended motion.

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/lib/features/studio-drawing/StudioDrawingPage.svelte` | Add scene-state orchestration, book-stage composition, and delayed reveal of drawing controls |
| `apps/web/src/lib/features/studio-drawing/components/DrawingCanvas.svelte` | Add interaction gating so the canvas ignores input until the book has opened |
| `apps/web/src/lib/features/studio-drawing/StudioDrawingPage.svelte.spec.ts` | Add or update tests for closed, opening, and open route behavior |

### Likely New Files

| File | Purpose |
|---|---|
| `apps/web/src/lib/features/studio-drawing/components/DrawingBookStage.svelte` | Encapsulate the closed/open book visuals and animation shell |

Additional support files are acceptable only if the animation styling becomes hard to keep readable inside the page component.

## Files Not Changed

These parts of the feature should keep their existing behavior:

- `apps/web/src/routes/draw/+page.svelte` — continues to hand off route data to the studio feature.
- Draw route server logic and publish action handling.
- Artwork export and publish contract types.
- Existing moderation checks for the artwork title.

## Testing Strategy

### Unit Tests

- `StudioDrawingPage.svelte.spec.ts`: verify the initial render shows the closed-book state and does not expose active drawing controls yet.
- `StudioDrawingPage.svelte.spec.ts`: verify activating the book transitions the scene to an open state where the canvas and tools are available.
- `StudioDrawingPage.svelte.spec.ts`: keep existing publish-success, publish-error, and validation coverage working once the open-state setup is performed.
- `DrawingCanvas.svelte.spec.ts`: verify drawing input is ignored while interaction is disabled and works once enabled.

### Manual Verification

- Open `/draw` and confirm the first visible state is a closed book.
- Click or tap the cover and confirm the book opens into a blank drawable page.
- Confirm no strokes can be drawn before the open state completes.
- Confirm tools and metadata UI appear only after the opening sequence.
- Draw, clear, and publish to confirm the book shell does not break the current studio workflow.
- Verify the experience remains usable on a narrow mobile viewport.

## Out of Scope

- Multi-page drawing or actual page turning after the book is opened.
- Reusing `turn.js`, jQuery, or the demo assets directly in production.
- Changing artwork publishing contracts or adding new backend behavior.
- Adding narrative content or gameplay systems to the left page.