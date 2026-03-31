# Ambient Audio Control

**Date:** 2026-03-31
**Status:** Proposed

## Problem

The product wants a global ambient music layer that reinforces the tactile, playful tone of the site without turning into a full music player. The control should feel like a small world object rather than an app widget: always visible, visually discreet, and limited to a single action, mute/unmute.

The desired behavior is intentionally narrow:

- The control is global and remains visible across the site.
- Audio rotates automatically through a very small playlist (up to 3 tracks) in a loop.
- The first visit should start with ambient audio enabled.
- After that, the user's preference should persist across sessions.
- The implementation must not block page access or initial rendering.
- A short fade-in on first successful playback is desirable, but the design should stay KISS.

## Design

### Product Shape

This is not a player. There is no scrubber, volume slider, playlist drawer, or manual track switching in the first version.

The control exposes only:

- ambient audio on/off
- a small current-track label

The current track label is informational only. It confirms that the soundtrack is alive and rotating, but it does not invite the user into music-player interactions.

### Visual Direction

The control uses the chosen "paper tab" direction: a small floating paper-like annotation that feels pinned onto the world rather than rendered as chrome.

UI characteristics:

- fixed positioning, visible on all routes
- small footprint with soft rotation and gentle shadow
- editorial/studio styling aligned with the current paper, ink, terracotta, and muted-green palette
- concise copy such as `Ambience` plus the current track title
- a single clear on/off gesture

State treatment:

- `on`: warm and slightly more alive visually
- `off`: more neutral but still intentional
- `loading`: subtle feedback only; avoid spinners or attention-grabbing motion
- `unavailable`: remain present but quiet only when playback cannot continue because assets failed entirely

### Architecture

Split the feature into 3 focused units.

#### 1. Global Ambient Audio Controller

Mount a single controller in the global layout so it survives route changes and owns the audio lifecycle.

Responsibilities:

- create and manage the browser audio element
- lazily initialize the playlist in the client after the app is interactive
- rotate to the next track automatically when playback ends
- expose a simple state model for the UI
- apply a minimal fade-in on first successful playback
- handle blocked autoplay and track-load failure without breaking the app

Suggested state shape:

- `enabled: boolean`
- `hydrated: boolean`
- `playbackAvailable: boolean`
- `initializing: boolean`
- `currentTrackIndex: number`
- `currentTrackLabel: string | null`
- `hasUserInteractedSinceMount: boolean`

#### 2. Floating Ambient Control Component

The paper-tab component is presentation-only. It receives derived state and emits a `toggle` action.

Responsibilities:

- render the floating annotation
- display whether ambience is on or off
- display the small current-track label when available
- show restrained loading/unavailable states
- remain accessible on desktop and mobile

Non-responsibilities:

- no direct audio-element manipulation
- no storage access
- no network persistence logic

#### 3. Preference Persistence Layer

Use a hybrid persistence model.

Local behavior:

- use `localStorage` for immediate startup and anonymous visitors
- default to `enabled = true` when no prior preference exists
- persist every toggle immediately in local storage

Authenticated behavior:

- bootstrap the authenticated viewer's ambient-audio preference in server-provided route/layout data before the first client playback attempt whenever a signed-in viewer is already known
- if that bootstrapped remote ambient-audio preference already exists, use it as the initial effective preference and mirror it to local storage
- if no remote ambient-audio preference exists yet, preserve the local or default-enabled state and optionally backfill the remote preference only after the user makes an explicit toggle choice
- when the user toggles the setting, update local state immediately and persist remotely without blocking the UI

Reconciliation rule:

- bootstrapped remote preference wins for authenticated startup because it is available before the first playback attempt
- any later background response only wins if it arrives before any local user interaction in the current mount cycle
- if the user toggles before a later remote response returns, ignore the stale remote response and preserve the newer local intent
- remote preference must not trigger a second audible flip after the user has already interacted

This keeps the experience fast on first paint while still supporting true cross-session persistence for signed-in users.

### Preference Data Model

Reuse the existing viewer-preference pattern rather than inventing a separate audio-only store.

Extend the current `viewer_content_preferences` record with an ambient-audio field instead of creating a parallel preference table. The adult-content preference already establishes that this application treats viewer-level settings as global user preferences.

Suggested additions:

- `ambientAudioEnabled: boolean | null`
- optional `ambientAudioUpdatedAt: timestamp` only if planning needs explicit audit timing; otherwise rely on the existing row `updatedAt`

`null` means the viewer has no persisted ambient-audio preference yet. This is required so authenticated first visits can still honor the product rule of defaulting to enabled.

API direction:

- extend `GET /api/viewer/content-preferences` to include `ambientAudioEnabled`
- extend `PATCH /api/viewer/content-preferences` to accept `ambientAudioEnabled`

PATCH semantics must be sparse and partial:

- only fields present in the request body are updated
- omitted preference fields keep their current stored values
- toggling ambient audio must not reset adult-content preferences, and vice versa

Service direction:

- add service helpers parallel to the existing adult-content preference flow, or refactor the service to update both preferences in one coherent record without coupling unrelated business rules

### Playback Flow

Client flow on first load:

1. Render the site normally with no audio dependency.
2. If a signed-in viewer is already known, hydrate the bootstrapped remote ambient-audio preference from route/layout data.
3. Mount the global controller in the browser.
4. Read `localStorage` for ambient audio preference.
5. Resolve the initial effective preference in this order: bootstrapped remote value when present, otherwise local value when present, otherwise first-visit default `enabled = true`.
6. Render the floating paper-tab control immediately.
7. Lazily initialize the audio resource after the page is interactive.
8. Attempt playback if the effective preference is enabled.
9. If playback succeeds, apply a short fade-in and expose the current track label.
10. If no bootstrapped remote value was available but the viewer is authenticated, an additional background fetch may reconcile the state under the normal stale-response rules above.

Track rotation flow:

1. Start from the current track index.
2. When the current track ends, advance to the next item in the loop.
3. Attempt playback of the next track.
4. If a track fails to load, skip to the next track.
5. If all tracks fail, stop retrying aggressively and leave the control in a silent available/unavailable state.

Toggle flow:

1. User toggles ambience off or on.
2. UI updates immediately.
3. Controller pauses playback and resets the current track position to the start when toggled off; toggling back on resumes from the current track selection rather than restoring elapsed position.
4. New preference is written to local storage immediately.
5. If the viewer is authenticated, persist the change remotely in the background.

Autoplay-blocked flow:

1. The controller attempts the first automatic start if the effective preference is enabled.
2. If the browser blocks playback, the controller leaves the site fully usable and falls back to the normal `off` visual state.
3. This blocked attempt does not persist a new remote or local preference by itself.
4. The single control keeps normal semantics: clicking it from that state is a standard "turn ambience on" action and retries playback.
5. If the retry succeeds, playback begins with the minimal fade-in and the enabled preference is persisted.

### Lazy Loading and Performance

Audio must never delay access to content.

Constraints:

- no server-side dependency on audio assets for route rendering
- no blocking fetch before showing the page
- initialize audio only on the client
- avoid loading the full playlist upfront if the implementation can keep complexity low by loading the active track first and subsequent tracks on demand

Playlist source for v1:

- ship the audio tracks as static bundled assets in `apps/web/static/`
- define a tiny client-side manifest in `apps/web/src/lib/features/ambient-audio/playlist.ts`
- keep playlist selection entirely static in version one; no CMS, database, or admin configuration

KISS guidance:

- use a standard `HTMLAudioElement` first
- avoid a full Web Audio graph unless fade behavior cannot be implemented simply enough
- keep preloading strategy conservative: current track first, next track opportunistically only if trivial

### Fade-In Behavior

Fade-in should be intentionally small and limited.

Rules:

- only on the first successful playback start of a session, or when resuming from a fully muted/off state if needed for smoothness
- target duration roughly 600 to 1200 ms
- no crossfade between tracks in version one
- no dynamic ducking, equalization, or mixing controls

If a simple `audio.volume` ramp is sufficient, prefer it over more advanced audio APIs.

### Error Handling and Degradation

The feature must fail quietly.

Scenarios:

- **Autoplay blocked**: keep the control visible, leave the site interactive, fall back to the normal off state, and let the next on-toggle retry playback.
- **Track load failure**: skip to the next track in the loop.
- **All tracks fail**: remain silent without surfacing a disruptive error.
- **Remote preference save fails**: keep the local preference applied and optionally log/report the persistence failure, but do not punish the user by reverting the toggle.
- **Local storage unavailable**: treat the session as ephemeral and continue with in-memory state.

### Accessibility

Even though the control is small and decorative in tone, it still needs straightforward accessibility.

Requirements:

- keyboard-focusable toggle
- accessible name that describes the state, for example "Mute ambient audio" or "Enable ambient audio"
- sufficient contrast in all states
- touch target sized for mobile use
- do not rely on audio alone to communicate state

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/routes/+layout.svelte` | Mount the global ambient audio controller so it survives route changes |
| `apps/web/src/lib/features/shared-ui/components/` | Add the floating paper-tab ambient control component and any small supporting presentational pieces |
| `apps/web/src/lib/features/ambient-audio/` | Add the ambient audio controller, state module, and static playlist manifest responsible for rotation, lazy initialization, fade-in, and preference reconciliation |
| `apps/web/src/routes/api/viewer/content-preferences/+server.ts` | Extend GET/PATCH contract to include ambient audio preference |
| `apps/web/src/lib/server/moderation/service.ts` | Add or refactor viewer preference service logic for ambient audio persistence |
| `apps/web/src/lib/server/moderation/types.ts` | Extend viewer preference types with ambient audio fields |
| `apps/web/src/lib/server/moderation/repository.ts` | Persist and retrieve ambient audio preference from the shared preference row |
| `apps/web/src/lib/server/db/schema.ts` | Extend `viewer_content_preferences` with ambient audio columns |
| `apps/web/drizzle/*` | Add the generated migration for the schema change |

## Files Not Changed

The feature does not require a dedicated music-player surface, playback queue UI, or separate user settings page in the first version.

## Testing Strategy

### Unit Tests

- Controller initializes with `enabled = true` on first visit when no local or remote preference exists.
- Controller honors a stored local preference on subsequent visits.
- Controller rotates to the next track when playback ends.
- Controller skips failed tracks without crashing.
- Controller keeps local state when remote preference persistence fails.
- Fade-in logic only runs for allowed playback starts and stays within the minimal supported path.
- Presentational control renders correct state and emits toggle events.
- Viewer content preference endpoint returns and updates `ambientAudioEnabled`.
- Service/repository tests cover reading and writing the new preference field.

### Integration Tests

- Global layout keeps the control mounted across route navigation.
- Toggling the control updates the visible state and persists preference locally.
- Authenticated preference fetch reconciles startup state without blocking page access.

### Manual Verification

- First anonymous visit starts with ambience enabled and the site remains fully interactive while audio initializes.
- Refresh after muting keeps the control muted.
- Signed-in user changes the preference, reloads, and sees the same state restored.
- Navigate between home, gallery, and draw without duplicating playback instances.
- Simulate blocked autoplay and confirm the control remains usable.
- Verify mobile tap target and fixed placement remain unobtrusive.

## Open Decisions Intentionally Deferred

These are explicitly out of scope for this version:

- manual next/previous track controls
- visible playlist UI
- per-route soundtrack selection rules
- track progress display
- crossfade between songs
- separate volume control
- settings page for ambient audio
