# Client-Side Content Filters

**Date:** 2026-03-28
**Status:** Proposed

## Goal

Add a client-side moderation layer that blocks unsafe text and image content
before it reaches existing signup, avatar, publish, and comment flows.

## Why

The PRD already establishes NSFW image screening as a client-side pre-publish
gate, but the current frontend has no moderation checks at all:

- signup accepts any nickname that matches the structural pattern
- comments post directly to the API once they are non-empty
- avatar onboarding uploads whatever the client exports
- artwork publishing uploads whatever the client exports

This change adds an explicit browser-side safety gate without changing the
existing backend contracts.

## Approved Policy

### Text Filtering

- use `obscenity`
- support English and Spanish from day one
- apply to nicknames and comments only in this slice
- block all detected matches
- do not silently censor or rewrite user input
- if the text moderation module cannot load or initialize, fail closed and
  block submission with an unavailable message

### Image Filtering

- use `nsfwjs`
- apply to avatar uploads and artwork publishes
- run after client export and before the existing upload or publish request
- fail closed if the detector is unavailable or cannot complete its check
- preserve the PRD blocking thresholds for the first implementation:
  - block when `Porn > 0.7`
  - block when `Hentai > 0.7`
- do not block on `Sexy` in this slice; the PRD warning behavior remains a
  future UI refinement outside this first moderation integration

## Scope

The change will:

- add a shared client-side content filter service for text and images
- block offensive nicknames during signup before the signup form submits
- block offensive comments before the comment API request is sent
- block NSFW avatars before the avatar upload request is sent
- block NSFW artworks before the artwork publish request is sent
- use lazy loading so moderation dependencies do not inflate the initial home
  route bundle unnecessarily
- add component-level automated tests for blocked and unavailable cases

The change will not:

- add backend moderation parity in the same slice
- filter artwork titles yet
- filter login or recovery nickname input
- auto-rewrite or mask text input
- add moderation telemetry or analytics
- add end-to-end tests that depend on the real browser ML model heuristics

## Recommended Approach

Create a small shared client-side moderation layer with two stable entry points:

- `checkText(value, context)`
- `checkImage(file, context)`

Components stay responsible for their own local UI state and submit behavior,
but they do not own the moderation logic itself.

This keeps the implementation smaller than a global moderation store while
avoiding duplicated filter setup and inconsistent policy across components.

## Architecture

### Shared Client Filter Layer

Add a browser-only utility area under `src/lib/client/content-filter/`.

Proposed files:

- `src/lib/client/content-filter/index.ts`
- `src/lib/client/content-filter/text-filter.ts`
- `src/lib/client/content-filter/image-filter.ts`

The shared contract should be small and explicit:

```ts
export type ContentFilterResult =
	| { status: 'allowed' }
	| { status: 'blocked'; message: string }
	| { status: 'unavailable'; message: string };
```

The public API should also use explicit context types rather than ad hoc string
values:

```ts
export type TextFilterContext = 'nickname' | 'comment';
export type ImageFilterContext = 'avatar' | 'artwork';
```

### Text Filter

The text filter should:

- initialize `obscenity` with English and Spanish dictionaries or rule sets
- expose context-aware checks for at least `nickname` and `comment`
- return product-facing block messages rather than raw library output
- run synchronously or near-synchronously on the client
- lazy-load the library internally from the shared service
- keep initialization state in module-level variables inside the text filter
  service, not in component state

If the dynamic import or setup fails, the text filter should return
`unavailable` rather than throwing so calling components can fail closed with a
stable UX path.

Example context-specific behavior:

- nickname: `Choose a different nickname.`
- comment: `This comment breaks the gallery rules.`
- nickname unavailable: `Nickname safety check is unavailable right now. Please try again.`
- comment unavailable: `Comment safety check is unavailable right now. Please try again.`

For this slice, these product-facing messages should live inside the shared
content filter service rather than in the components, so the policy and copy
remain coupled.

### Image Filter

The image filter should:

- lazy-load `nsfwjs` only when avatar or publish flows need it
- keep a singleton model promise so the browser does not load the model more
  than once per session
- classify the exported image before request dispatch
- return a blocked result when configured thresholds are exceeded
- return an unavailable result if model load or classification fails

Implementation detail:

- use module-level state inside `image-filter.ts`
- keep one cached model promise for successful or in-flight loads
- clear the cached promise if model initialization fails so a later user retry
  can attempt a fresh load
- treat any thrown error during import, model load, image decoding, or
  classification as `unavailable`

Even if avatar and artwork share the same thresholds initially, keep distinct
contexts such as `avatar` and `artwork` so policy can diverge later without
changing component call sites.

The image filter should accept the exported `File` produced by the existing UI
flow. Input preparation stays minimal in this slice because both current export
paths already produce browser-native image files:

- avatar export produces `image/png`
- artwork export produces the existing artwork file output used by publish

If `nsfwjs` cannot classify the exported file after decoding it for inference,
the result is `unavailable` and the action stays blocked.

## Integration Points

### Signup Nickname

Integrate the text filter into
`src/lib/features/home-entry-scene/components/AuthOverlay.svelte`.

The signup validation sequence should become:

1. normalize nickname
2. validate existing structural rules already enforced by the UI and server
  schema, namely the current lowercase nickname pattern and length rules
3. validate existing password rules already enforced by the UI and server
  schema
4. validate nickname availability result state
5. run text moderation for the nickname
6. block submit if moderation fails

The filter applies only to signup. It should not run on sign-in or recovery,
because blocking existing accounts from authenticating in the browser would be
an unsafe behavioral regression.

### Comments

Integrate the text filter into
`src/lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte`.

The comment flow should:

1. trim the comment
2. reject the trimmed comment if it is empty
3. run text moderation on that trimmed body only
4. show `actionError` and stop if moderation blocks
5. send the existing request only when moderation allows it

### Avatar Upload

Integrate the image filter into
`src/lib/features/home-entry-scene/components/AvatarSketchpad.svelte`.

The avatar flow should:

1. export the PNG avatar file as it does today
2. run image moderation on that exported file
3. show `saveError` and stop if the result is `blocked`
4. show `saveError` and stop if the result is `unavailable`
5. call the existing `saveAvatar` function only when moderation allows it

### Artwork Publish

Integrate the image filter into
`src/lib/features/studio-drawing/StudioDrawingPage.svelte`.

The publish flow should:

1. validate title presence as it does today
2. export the artwork file as it does today
3. run image moderation on the exported file
4. show the existing publish status error area and stop if the result is
   `blocked`
5. show the existing publish status error area and stop if the result is
   `unavailable`
6. call the existing `publishDrawing` function only when moderation allows it

Artwork titles stay out of scope for this slice.

## Loading Strategy

The content filter service should use dynamic imports so the homepage and basic
navigation do not eagerly pay for moderation dependencies.

Expected behavior:

- `text-filter.ts` lazy-loads `obscenity` internally the first time signup
  validation or comment submission needs it
- `image-filter.ts` lazy-loads `nsfwjs` internally the first time avatar save
  or artwork publish needs it
- repeated checks reuse previously loaded modules and model state

This is especially important for the home route, where the initial experience is
heavy on scene presentation and should not pick up unnecessary moderation cost.

## Error Handling

### Blocked Content

Blocked content should produce explicit user-facing messages and prevent the
existing request or form submit from happening.

Examples:

- nickname blocked: inline nickname error
- comment blocked: `actionError`
- avatar blocked: `saveError`
- artwork blocked: publish status error message

### Detector Unavailable

Detector availability is part of the enforcement policy for both text and image
moderation in this slice. If the dependency cannot load or complete its check,
the UI should block the action with a clear retry message.

`Unavailable` includes:

- dynamic import failure
- library or model initialization failure
- image decode failure for moderation input
- classification failure
- any thrown runtime error during the moderation call path

Recommended wording:

- nickname: `Nickname safety check is unavailable right now. Please try again.`
- comment: `Comment safety check is unavailable right now. Please try again.`
- avatar: `Avatar safety check is unavailable right now. Please try again.`
- artwork: `Artwork safety check is unavailable right now. Please try again.`

Retry behavior remains simple: the user edits nothing special and just retries
the same action, which re-enters the moderation path.

## Testing Strategy

### Component Tests

Add focused tests that stub the moderation layer rather than the underlying
libraries directly.

Required coverage:

- signup blocks a nickname when the text filter returns `blocked`
- signup blocks a nickname when the text filter returns `unavailable`
- signup still submits when the text filter returns `allowed`
- comment submission blocks when the text filter returns `blocked`
- comment submission blocks when the text filter returns `unavailable`
- avatar save blocks when the image filter returns `blocked`
- avatar save blocks when the image filter returns `unavailable`
- artwork publish blocks when the image filter returns `blocked`
- artwork publish blocks when the image filter returns `unavailable`

### End-to-End Strategy

Do not depend on the real `nsfwjs` model in Playwright for this slice.

If e2e coverage is added later, stub the client filter service or inject a test
mode so the journeys remain deterministic and fast.

## Files Expected To Change

| File | Change |
|---|---|
| `src/lib/client/content-filter/index.ts` | Shared exports for moderation checks |
| `src/lib/client/content-filter/text-filter.ts` | `obscenity`-based nickname and comment filtering |
| `src/lib/client/content-filter/image-filter.ts` | lazy-loaded `nsfwjs` model and avatar/artwork image checks |
| `src/lib/features/home-entry-scene/components/AuthOverlay.svelte` | block signup nickname submission when text moderation fails |
| `src/lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte` | block comment submission when text moderation fails |
| `src/lib/features/home-entry-scene/components/AvatarSketchpad.svelte` | block avatar upload when image moderation fails or is unavailable |
| `src/lib/features/studio-drawing/StudioDrawingPage.svelte` | block artwork publish when image moderation fails or is unavailable |
| related component spec files | cover allowed, blocked, and unavailable paths |

## Risks And Tradeoffs

- Browser-side moderation improves UX and reduces obvious abuse, but it is not a
  trust boundary by itself.
- Hard blocking on detector unavailability is stricter and can frustrate users
  during model-load failures, but it matches the approved fail-closed image
  policy.
- Spanish and English coverage will be better than English-only profanity
  filtering, but dictionary-based text moderation will still require tuning over
  time.

## Follow-Up Work

Natural next slices after this design:

- add backend moderation parity for nickname and comment writes
- extend text moderation to artwork titles if product policy wants it
- centralize moderation message copy with broader product error-copy guidelines