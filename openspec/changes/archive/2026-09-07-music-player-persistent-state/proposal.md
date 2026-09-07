## Why

Ambient audio currently defaults to on when no preference exists and always forgets which song the visitor had reached. That makes first visit playback feel intrusive and ignores the user's last listening context even though the product already has a backend-backed preference surface for on/off.

## What Changes

- Default ambient audio to off when no saved preference exists.
- Persist the last selected ambient track locally across reloads while keeping on/off preference canonical.
- Continue syncing the enabled or disabled preference through the existing viewer content-preferences backend for authenticated users.
- Keep playback-position persistence out of scope for this change.
- Add controller and preference coverage for first-visit defaults, reload behavior, and authenticated preference sync.

## Capabilities

### New Capabilities
- `ambient-audio-preferences`: Ambient audio respects persisted user intent across reloads, defaulting off until enabled and resuming from the last selected track.

### Modified Capabilities

## Impact

- Affected code: `apps/web/src/lib/features/ambient-audio/AmbientAudioController.svelte`, `apps/web/src/lib/features/ambient-audio/preferences.ts`, related layout bootstrapping, and ambient-audio tests.
- Affected behavior: first-visit audio state, reload-time track continuity, and authenticated preference syncing to the existing viewer content-preferences route.
- Dependencies: current ambient playlist, local storage availability, and the existing `/api/viewer/content-preferences` PATCH contract for ambient audio on/off.