## Why

The app already has a museum sticker-button direction, but the production shared controls still fall short of the fidelity shown in `apps/web/static/html-objects/museum-sticker-button.html`, and several product surfaces still bypass the shared sticker primitives entirely. That leaves the UI feeling inconsistent just as the museum framing system is becoming more deliberate.

## What Changes

- Upgrade the shared sticker control primitives so `GameButton` and `GameLink` match the reference button artifact much more closely in sizing, spacing, text treatment, icon handling, disabled state, and overall material feel.
- Expand the shared sticker control API as needed to support the preview's real-world usages, including text-only, icon-plus-label, ghost, and compact/large variants.
- Replace product-facing one-off buttons and links that should use the museum sticker system but currently render custom markup.
- Keep non-product demo pages out of scope unless they already depend on shared primitives.

## Capabilities

### New Capabilities
- `sticker-controls`: Shared museum sticker buttons and links with production-ready fidelity and consistent variant behavior across product surfaces.

### Modified Capabilities
- `artwork-discovery`: Gallery and hall-of-fame interactions should present primary navigation and artwork actions through the shared sticker control language where appropriate.
- `identity-and-access`: Product auth and session actions should use the shared sticker control language for their primary interactive controls.

## Impact

- Affected code: `apps/web/src/lib/features/shared-ui/components/GameButton.svelte`, `apps/web/src/lib/features/shared-ui/components/GameLink.svelte`, product surfaces under `apps/web/src/lib/features/home-entry-scene/`, `apps/web/src/lib/features/gallery-exploration/`, `apps/web/src/lib/features/artwork-presentation/`, and `apps/web/src/lib/features/studio-drawing/` where custom buttons should be upgraded.
- Affected assets/reference artifacts: `apps/web/static/html-objects/museum-sticker-button.html` and sticker drawing logic in `apps/web/src/lib/features/home-entry-scene/canvas/museum-canvas.ts`.
- Affected systems: shared UI primitives, navigation controls, auth CTA presentation, artwork action controls, and component test coverage for button fidelity and adoption.
