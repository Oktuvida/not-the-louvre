# Avatar Upload Flow

**Date:** 2026-03-28
**Status:** Proposed

## Problem

The signup flow includes an avatar drawing step (`AvatarSketchpad`), but the drawing is silently discarded. The "Enter the gallery" button dispatches `AUTH_SUCCESS` without exporting the canvas or uploading anything. The entire server-side avatar pipeline (service, storage, API routes, media sanitization) is production-ready and tested, but the frontend never calls it.

## Design

### Canvas-to-Upload Bridge

When "Enter the gallery" is clicked, `AvatarSketchpad` performs three steps before dispatching success:

1. **Resize** — Create an offscreen 256x256 canvas. The source canvas is 520x320; extract the largest centered square (320x320, offset 100px from left) and draw it scaled down to 256x256. This preserves the centered silhouette and any user strokes.
2. **Encode** — Call `offscreenCanvas.toBlob(callback, 'image/avif', 0.9)` for client-side AVIF encoding. AVIF is supported in Chrome 121+, Edge 121+, Safari 16.4+, and Firefox 113+.
3. **Upload** — Send the blob to `PUT /api/users/{userId}/avatar` as multipart `FormData` with a `file` field. This matches the existing API contract.

### Ghost Silhouette as Canvas Pixels

Replace the current CSS overlay ghost silhouette with canvas-drawn equivalents during `onMount`, so the guide is part of the exported image data:

1. Paint the parchment background (`#f5f0e1`).
2. Draw a dashed-stroke circle (head) and a dashed-stroke rounded rectangle (shoulders) centered on the canvas, at low opacity (~0.15) in `#2d2a26`. This matches the wireframe reference in `samples/NotTheLouvreAuthFlow.html`.
3. The CSS overlay divs for the ghost silhouette are removed.

If the user never draws, the exported avatar contains the silhouette outline — a recognizable placeholder that still looks intentional.

### Upload UX

- **Blocking with feedback**: The button shows a "Saving..." label and is disabled during upload. The user waits for the upload to complete before entering the gallery.
- **Always upload**: The canvas always has the silhouette, so there is no blank-canvas check. Every signup produces an avatar.
- **Error handling**: On upload failure, show an inline error message and re-enable the button so the user can retry. Do not block gallery entry indefinitely — after a failed upload, the user can still proceed (their avatar will be null, which display components already handle with conditional rendering).

### Data Flow Changes

#### Props

`AvatarSketchpad` gains a `userId: string` prop. `AuthOverlay` stashes `result.user.id` from the signup response and passes it through.

#### Auth Client

Add an `uploadAvatar` function to `auth-client.ts`:

```typescript
export async function uploadAvatar(userId: string, blob: Blob): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append('file', new File([blob], 'avatar.avif', { type: 'image/avif' }));
  return await requestJson(`/api/users/${userId}/avatar`, { method: 'PUT', body: form });
}
```

#### Session Type

Add `avatarUrl?: string` to the `SessionUser` type in `auth-client.ts` so the frontend can access avatar info from session data.

### Touch Support

Add `ontouchstart`, `ontouchmove`, and `ontouchend` handlers to the canvas, mirroring the existing mouse handlers. Extract a shared `getPoint` that handles both `MouseEvent` and `TouchEvent` coordinate extraction.

## Files Changed

| File | Change |
|---|---|
| `src/lib/features/home-entry-scene/components/AvatarSketchpad.svelte` | Replace CSS ghost silhouette with canvas-drawn guide; add canvas export + resize + AVIF encoding; add upload via `uploadAvatar`; add `userId` prop; add loading/error state; add touch event handlers |
| `src/lib/features/home-entry-scene/components/AuthOverlay.svelte` | Stash `result.user.id` after signup; pass `userId` to `AvatarSketchpad` |
| `src/lib/auth-client.ts` | Add `uploadAvatar` function; add `avatarUrl` to `SessionUser` type |

## Files Not Changed

The server-side code is already complete and tested:

- `src/routes/api/users/[userId]/avatar/+server.ts` — PUT handler accepts FormData with `file` field
- `src/lib/server/user/avatar.service.ts` — validates auth, sanitizes media (256x256 AVIF, max 100KB), uploads to storage
- `src/lib/server/media/sanitization.ts` — AVIF validation and canonical re-encoding
- `src/lib/server/user/storage.ts` — Supabase storage adapter
- `src/lib/server/user/config.ts` — avatar constraints (256x256, 100KB, AVIF)
- `src/lib/server/db/schema.ts` — `avatar_url` column on `app.users`

## Testing Strategy

### Unit Tests

- `AvatarSketchpad`: Test that `onContinue` calls `uploadAvatar` with the correct userId and a Blob argument. Test loading/error state transitions.
- `auth-client.ts`: Test that `uploadAvatar` sends a PUT with FormData containing the file.

### Manual Verification

- Complete signup flow end-to-end: create account, draw avatar, click "Enter the gallery", verify avatar appears in gallery.
- Verify blank canvas (no user drawing) still uploads the silhouette successfully.
- Verify upload error shows inline message and allows retry.
- Verify touch drawing works on mobile viewport.
