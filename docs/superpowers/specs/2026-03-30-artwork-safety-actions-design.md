# Artwork Safety Actions

**Date:** 2026-03-30
**Status:** Proposed

## Goal

Add lightweight safety actions directly on artwork presentation surfaces so viewers can report problematic artwork without leaving the gallery, and admins can quickly suppress content from the same surfaces.

The change should add:

- a `Report` action on paper-noise cards and artwork detail panels
- admin-only quick actions for `Hide` and `NSFW`
- reuse of the existing backend routes for reporting and moderation

## Decisions Confirmed

- actions appear on both the paper-noise card and the detail panel
- admin shortcut should expose two quick actions: `Hide` and `NSFW`
- `Report` should open a compact reason picker instead of firing a single default reason
- implementation should prefer a shared UI component instead of duplicating behavior in each surface

## Scope

This change will:

- add a shared client component for artwork safety actions
- render it inside `ArtworkCard` and `ArtworkDetailPanel`
- use the existing artwork report endpoint for authenticated reporting
- use the existing artwork moderation endpoint for admin quick actions
- update client tests for both presentation surfaces

This change will not:

- add comment reporting from these surfaces
- add moderator shortcuts beyond the requested admin shortcut
- add new backend endpoints if the current ones already satisfy the UI
- introduce a full moderation form with free-text details in the artwork UI

## Recommended Approach

Create a shared `ArtworkSafetyActions` component and use it from both artwork surfaces.

Why this approach:

- one permission model for card and detail panel
- one reason-picker interaction for reporting
- one place to manage client feedback and fetch behavior
- minimal change to gallery composition because each parent only decides placement and styling context

## Interaction Design

### Paper-noise card

- show a compact overlay cluster on hover/focus
- authenticated viewers see `Report`
- admins additionally see `Hide` and `NSFW`
- the reason picker opens inline and stays visually small so the card still reads as artwork-first

### Detail panel

- show the same actions persistently in a visible toolbar
- preserve success/error feedback in the panel after the request completes
- after `Hide` or `NSFW`, sync the updated artwork back into the active detail state

## Technical Design

### Shared component

Proposed component responsibilities:

- receive `artworkId`
- receive `viewer`
- optionally receive current moderation state for optimistic UI control
- expose callbacks for `onArtworkChange` and `onFeedback`
- call the existing routes:
  - `POST /api/artworks/[artworkId]/reports`
  - `PATCH /api/artworks/[artworkId]/moderation`

Suggested report reasons for the picker should map directly to the backend enum already defined in the artwork domain.

### Parent integration

`ArtworkCard`:

- mount the safety actions in a small positioned overlay
- stop action clicks from triggering the card open behavior

`ArtworkDetailPanel`:

- mount the safety actions next to the existing vote/comment/fork controls
- use the existing artwork sync flow so moderation changes are immediately reflected in the selected artwork

## Authorization Rules

- unauthenticated viewers do not see `Report`
- authenticated viewers see `Report`
- only admins see the quick moderation shortcut in this UI change
- the UI is not the security boundary; backend authorization remains authoritative

## Error Handling

- failed report requests should show a compact inline error message
- duplicate or forbidden report attempts should surface backend messages as-is when available
- failed moderation actions should not mutate client state locally
- successful moderation should refresh or locally sync the artwork state so the UI reflects hidden/NSFW changes immediately

## Testing Strategy

- add client tests for the shared safety action component
- update `ArtworkCard` tests to verify visibility and interaction of the overlay actions
- update `ArtworkDetailPanel` tests to verify persistent actions and correct fetch calls
- verify that admin actions do not appear for non-admin viewers
- verify that report reasons send the expected backend enum values

## Risks

- overlay controls on the card can interfere with the main click target
  - mitigate by isolating pointer events and stopping propagation inside the action cluster
- duplicated local state between card and detail can drift
  - mitigate by centralizing the request and feedback logic inside one shared component
- admin quick actions could make the card feel too busy
  - mitigate by keeping them hover/focus-only on the card and persistent only in the detail panel