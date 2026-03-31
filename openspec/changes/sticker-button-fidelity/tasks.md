## 1. Shared Sticker Primitive Fidelity

- [x] 1.1 Add failing component tests for `GameButton.svelte` and `GameLink.svelte` that cover reference-aligned sizing, icon-plus-text layout, ghost support, and disabled treatment.
- [x] 1.2 Upgrade `GameButton.svelte` to better match `apps/web/static/html-objects/museum-sticker-button.html`, including size presets, typography, content layout, rotation behavior, and disabled styling.
- [x] 1.3 Upgrade `GameLink.svelte` to match the updated shared sticker button fidelity and API.

## 2. Product Adoption

- [x] 2.1 Identify product-facing one-off buttons and links that should use the shared sticker controls, and add failing component tests for the highest-value adoption targets.
- [x] 2.2 Migrate gallery and artwork presentation actions that should use shared sticker controls instead of custom markup.
- [x] 2.3 Migrate auth, entry, and other high-level product CTAs that should use shared sticker controls instead of custom markup.
- [x] 2.4 Leave dense utility controls untouched where sticker treatment would hurt clarity, and keep those exclusions intentional.

## 3. Validation

- [ ] 3.1 Run `bun run format`, `bun run lint`, `bun run check`, and `bun run test`, and resolve any issues introduced by the sticker button fidelity change.
