## Context

The project already contains the right visual artifact for buttons in `apps/web/static/html-objects/museum-sticker-button.html`, and the production canvas renderer already lives in `apps/web/src/lib/features/home-entry-scene/canvas/museum-canvas.ts`. The current gap is not the underlying sticker background artwork but the production wrappers around it: shared controls do not expose the same sizing and content rules as the reference, and many product-facing actions still use raw buttons or links with unrelated styling.

This change should make sticker controls feel like a real system instead of a partial experiment. It must improve the fidelity of the shared primitives and spread them to the places where users actually encounter product actions, without forcing decorative sticker treatment onto low-level canvas tool toggles or unrelated demo pages.

## Goals / Non-Goals

**Goals:**
- Make `GameButton` and `GameLink` visually align with the sticker-button reference artifact.
- Support the reference's practical variants: icon + text, text-only, ghost, compact, medium, and large CTA sizing.
- Replace product-facing one-off buttons and links that should participate in the sticker system.
- Preserve the existing canvas background renderer as the source of truth for sticker material rendering.
- Keep adoption focused on high-level user-facing actions rather than every utility control in the app.

**Non-Goals:**
- Reworking low-level drawing tool toggles into sticker buttons if that would hurt usability or density.
- Restyling demo-only pages unless they already share the product primitives.
- Changing business behavior of auth, gallery, artwork, or studio actions.

## Decisions

### 1. Keep canvas sticker rendering centralized and upgrade the wrapper layer
The shared primitives should continue to use `drawStickerBackground` rather than duplicating the HTML artifact's drawing code. The fidelity work belongs in shared control sizing, content styling, icon sizing, contrast rules, disabled treatment, and interaction polish.

Alternative considered:
- Duplicate the preview file's JavaScript into each component: rejected because the renderer already exists and duplication would immediately drift.

### 2. Add explicit size and content variants to the shared controls
The current shared controls are too implicit. They should expose clear size presets and accommodate icon + text layouts without forcing each caller to hand-roll spacing and typography. This lets product surfaces match the reference consistently while keeping markup small.

Alternative considered:
- Continue relying on ad hoc `className` overrides for every usage: rejected because it preserves drift and makes adoption harder.

### 3. Replace only semantically high-level product actions
The adoption pass should target places where sticker buttons make the product feel intentional: navigation CTAs, auth submits, gallery room navigation, artwork detail actions, publish/exit buttons, and similar visible controls. Dense utility controls such as drawing tool chips or tiny moderation affordances can stay outside the first wave if sticker treatment would reduce clarity.

Alternative considered:
- Convert every button in the app: rejected because some controls are too compact or too utilitarian for the sticker language.

### 4. Share link and button behavior through aligned APIs, not divergent one-offs
`GameButton` and `GameLink` should feel like sibling primitives: same sizing model, same typography rules, same icon handling, same hover/active/disabled feel, and minimal visual drift. Where route handling differs, keep that difference internal.

Alternative considered:
- Maintain separate implementation behavior and tune them independently: rejected because it leads to visual mismatch across adjacent actions.

## Risks / Trade-offs

- [Converting too many controls to stickers could make dense interfaces noisy] -> Mitigation: limit adoption to high-level product actions and leave compact utility controls alone.
- [Shared primitive API expansion could break existing call sites] -> Mitigation: add backward-compatible defaults and migrate callers incrementally.
- [Canvas controls may resize poorly in responsive layouts] -> Mitigation: define explicit size presets and test the updated controls in their real containers.
- [Reference fidelity work may still drift if callers override typography and spacing too freely] -> Mitigation: move important styling into the shared primitives and reduce dependence on custom per-call classes.

## Migration Plan

1. Add failing tests for shared sticker control fidelity and adoption targets.
2. Upgrade `GameButton` and `GameLink` APIs and styling to align with the sticker reference.
3. Migrate selected product-facing one-off controls onto the shared primitives.
4. Validate affected surfaces with `format`, `lint`, `check`, and `test`.

Rollback is straightforward: revert migrated call sites to their previous controls and restore the earlier primitive styling.

## Open Questions

- Which studio controls should remain utilitarian rather than sticker-themed if density becomes an issue.
- Whether the shared primitives should eventually expose a common icon slot helper instead of relying on caller-provided inline emoji/SVG markup.
