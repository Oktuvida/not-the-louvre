## 1. Coverage

- [x] 1.1 Add failing component or route tests for successful fork publish reset and non-fork regression safety
- [x] 1.2 Add failing browser coverage for fork publish followed by canvas reset and reload staying empty

## 2. Fork Publish Reset

- [x] 2.1 Add or extract a helper that returns the draw route to empty new-artwork mode and clears fork persistence
- [x] 2.2 Use the empty-state helper after successful fork publish without disturbing failure handling or non-fork success behavior
- [x] 2.3 Ensure draw-again and reload remain empty after successful fork publish

## 3. Validation

- [x] 3.1 Run `bun run format`
- [x] 3.2 Run `bun run lint`
- [x] 3.3 Run `bun run check`
- [x] 3.4 Run `bun run test`