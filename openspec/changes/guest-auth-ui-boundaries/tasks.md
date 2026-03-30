## 1. Guest Mode Boundaries

- [x] 1.1 Update the home entry scene to render a signed-out landing experience without authenticated-only world navigation affordances.
- [x] 1.2 Update gallery navigation and top-level gallery chrome to hide authenticated-only destinations and create-art entry points for signed-out visitors.
- [x] 1.3 Update gallery route handling for `your-studio` so signed-out requests receive the intended private-space behavior instead of a normal empty room.

## 2. Read-Only Visitor Detail

- [x] 2.1 Update artwork detail rendering so signed-out visitors see read-only metadata and comments without vote, comment, or fork controls.
- [x] 2.2 Replace guest-facing empty-state and prompt copy that currently assumes studio ownership or authenticated publishing access.

## 3. Verification

- [x] 3.1 Add or update component tests covering signed-out versus authenticated rendering in home, gallery navigation, and artwork detail surfaces.
- [x] 3.2 Add or update route/server tests covering signed-out handling for private gallery entry points such as `your-studio`.
- [ ] 3.3 Run the required project quality gates after implementation: `bun run format`, `bun run lint`, `bun run check`, and `bun run test`.
