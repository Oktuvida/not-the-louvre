## 1. Coverage

- [x] 1.1 Add failing preference and controller tests for first-visit default off and last-track restoration
- [x] 1.2 Add or update authenticated tests ensuring backend ambient-audio preference sync still works with local track persistence

## 2. Ambient Audio Preference Model

- [x] 2.1 Extend ambient-audio preference helpers to resolve first-visit off and persist the last selected track identifier locally
- [x] 2.2 Update `AmbientAudioController.svelte` to restore the saved track while keeping backend enabled or disabled preference canonical
- [x] 2.3 Ensure playlist advancement and user toggles keep the saved track identifier current without persisting exact playback time

## 3. Validation

- [x] 3.1 Run `bun run format`
- [x] 3.2 Run `bun run lint`
- [x] 3.3 Run `bun run check`
- [x] 3.4 Run `bun run test`