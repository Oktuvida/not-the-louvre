# Cork Board Auth Overlay

**Date:** 2026-03-30
**Status:** Proposed

## Problem

The auth overlay (`AuthOverlay.svelte`) works functionally but uses generic UI elements — rounded bordered inputs, flat white panels, standard error boxes — that don't match the project's physical-object design language. Every other surface in the app is a tangible museum or craft object (post-it notes, polaroids, wax seals, brass plaques, sticker buttons), but the auth overlay looks like a standard SaaS login form dropped into a gallery.

## Design

### Visual Concept

The auth overlay becomes a cork board panel floating over the existing dark backdrop. The cork board has a wood frame border, a cork texture surface with grain dots, and all form elements are physical items pinned or taped to the board: post-it notes for headers, white paper cards for forms, index cards for key reveals, pushpins and masking tape for attachment.

This approach reuses the pushpin, masking tape, and post-it vocabulary that components like `PostItNote`, `PolaroidCard`, and `GameButton` already establish. The auth overlay becomes a coherent member of the design system rather than an exception.

### Overlay Structure

The existing overlay architecture stays the same:

- Outer `div` with dark radial-gradient backdrop, GSAP opacity/scale animation, `pointer-events` toggling — unchanged.
- Inner container switches from `StudioPanel` to a new cork board wrapper with wood frame and cork texture.
- The wrapper component does not need to be extracted as a shared component initially. It is specific to the auth overlay.

The cork board panel has two width modes, matching the current behavior:

- **Form views** (login, signup-account, recovery, key reveals): `max-width: 44rem` — the same as today.
- **Avatar sketchpad**: `max-width: 68rem` — the same expanded width used today.

### Close Button

The existing "Close" `GameButton` (ghost variant, size sm) remains in every view. It is positioned in the top-right area of the cork surface, styled as a small ghost `GameButton` sitting directly on the cork. Its behavior is unchanged: in the avatar view it calls `onAvatarDismiss` then dispatches `AUTH_SUCCESS`; in all other views it dispatches `AUTH_CANCEL`.

### Cork Board Surface

The cork surface is built from layered CSS:

1. **Cork grain**: `radial-gradient` dot pattern (similar density to the `paper-noise` utility but in warm brown tones).
2. **Color variation**: 2–3 large soft `radial-gradient` blobs at different positions to break up the flat color and simulate natural cork tone variation.
3. **Base gradient**: `linear-gradient` from `#c4a06e` to `#a88458` (warm cork brown, top-to-bottom).
4. **Wood frame**: `border` with a `linear-gradient` border-image in dark wood tones (`#6d4c30` to `#4a3020`), plus `box-shadow` for depth.

### View-by-View Breakdown

#### Login

- **Header**: Yellow post-it note pinned with masking tape. Title in Caveat ("Welcome Back"), subtitle ("The room missed you. Probably."). Slight rotation (`-1.8deg`).
- **Tabs**: Two `GameButton` sticker buttons side by side — "Sign In" (active/secondary) and "Sign Up" (ghost). The variant mapping matches the current code: `secondary` for the active login tab, `primary` for the active signup tab, `ghost` for the inactive tab.
- **Form card**: White paper card (`#fffdf7` to `#f8f2e5` gradient) with paper-noise texture, pinned to the board with two pushpins (top-left red, top-right blue). Slight rotation (`0.4deg`).
- **Inputs**: Dashed bottom-border (`2px dashed rgba(47,36,28,0.18)`), no side/top borders, no background. Text typed in Caveat. Placeholder in italic Caveat.
- **Labels**: Fredoka uppercase, tracked, small — same as current labels.
- **Actions**: "Use recovery key" as a Caveat wavy-underline link (left), "Sign In" as the existing `GameButton` (right).
- **Decorations**: Small polaroid photo pinned to the bottom-right corner (purely decorative, displays the same emoji/icon as the mockup or can be omitted if it adds complexity). Handwritten doodle annotation near the top-right. A green pushpin accent.

#### Signup (Account)

- **Header**: Pink post-it note. Title: "Draw Yourself". Subtitle: "Claim your nickname, then sketch the avatar that walks into the gallery."
- **Tabs**: Same sticker buttons, "Sign Up" active.
- **Form card**: Same white paper card, different attachment (one pushpin + one tape strip instead of two pushpins for variety).
- **Inputs**: Same dashed-underline style.
- **Availability feedback**: Caveat text below nickname input — green for available, red for taken. Same logic as current `availabilityState`.
- **Actions**: Step indicator text (Fredoka small uppercase: "Step 1: claim your wall") on the left, "Start Account" GameButton on the right.

#### Signup Success / Recovery Success (Key Reveal)

- **Header**: Yellow post-it note. Title: "Keep This Key" (signup) or "Replacement Key" (recovery).
- **Warning accent**: Small pink post-it pinned separately near the top-right, rotated, reading "SAVE THIS!!" in handwritten bold.
- **Index card**: Lined paper texture (repeating horizontal lines via `repeating-linear-gradient`), a faint red top-line (like real index cards), pinned with a green pushpin at the top center. The card is slightly rotated (`0.8deg`).
- **Key display**: Dark box (`#2d2a26` background, `#f5f0e1` text, monospace font) inside the index card — same visual as current.
- **Warning text**: Caveat in danger color below the key box — same copy as current.
- **Action**: "I Stored It" or "Back To Sign In" GameButton, right-aligned.

#### Recovery

- **Header**: Blue post-it note. Title: "Recover Access". Subtitle: "Use your one-time recovery key to get back inside."
- **Form card**: White paper card with two pushpins.
- **Fields**: Three inputs — nickname (dashed underline, Caveat), recovery key (dashed underline, monospace), new password (dashed underline, Caveat).
- **Actions**: "Back to sign in" wavy-underline link (left), "Recover Access" GameButton (right).
- **Decoration**: Handwritten doodle "don't panic!" in the corner.

#### Avatar Sketchpad

- **Header**: Green post-it note. Title: "Finish Your Avatar". Subtitle: "Sketch the face that walks into the gallery."
- **Paper card**: Large white paper card taped to the board (two tape strips at top corners, no pushpins — the tape holds a larger piece of paper). The card contains:
  - The existing `AvatarSketchpad` component, rendered inside the card's content area.
  - The card's background and paper-noise texture provide the "paper pinned to cork" feeling.
- **Instruction post-it**: Small yellow post-it pinned beside or above the controls area with encouraging text ("This becomes your identity in the gallery. Make it count!").
- **Actions**: "Skip" (ghost GameButton) and "Save & Enter" (primary GameButton). These are the existing skip/continue buttons from `AvatarSketchpad`, styled within the cork board context.

The `AvatarSketchpad` component itself is not modified internally. The cork board wrapping only changes its container presentation.

### Shared Visual Elements

These elements appear across multiple views:

| Element | CSS approach |
|---|---|
| Pushpin | `14px` circle with `radial-gradient` (highlight at 35% 35%), `box-shadow` for depth, `::after` for specular dot. Four color presets: red, blue, green, yellow. |
| Masking tape | Positioned `div`, `16px` height, translucent warm beige (`rgba(225,212,178,0.68)`), `repeating-linear-gradient` wrinkle lines. |
| Post-it note | Colored background (`linear-gradient` top-to-bottom), slight rotation from a seed, `box-shadow`, paper-curl `::after` on bottom-right corner. Color per view: yellow (login, key), pink (signup), blue (recovery), green (avatar). |
| Form card | White paper gradient, `border-radius: 4px`, paper-noise `::before`, `box-shadow` for lift, slight rotation. |
| Index card | Similar to form card but with `repeating-linear-gradient` horizontal lines and a red header line via `::after`. |
| Doodle annotation | Absolutely positioned, Caveat font, muted red-brown at 40% opacity, slight rotation. Decorative only. |
| Error banner | Same background/border colors as current (`#f7e1d7` bg, `#c87060` border), but with Caveat font, slight rotation (`-0.5deg`), and `border-radius: 0.5rem`. |

### Form Behavior

No behavioral changes. All form logic, validation, GSAP animations, availability checking, form submission, and state machine transitions remain exactly as they are in the current `AuthOverlay.svelte`. This is a purely visual restyling.

The only structural changes:

1. Replace `StudioPanel` wrapper with the cork board frame/surface markup.
2. Replace the inner double-bordered content `div` with the form card / index card markup depending on the view.
3. Replace the `grid grid-cols-2` tab buttons with sticker-tab styled `GameButton` components.
4. Restyle inputs from bordered boxes to dashed-underline inputs.
5. Restyle error banners with Caveat font and slight rotation.
6. Add decorative elements (pushpins, tape, doodles, polaroid) as absolutely positioned elements.

### Accessibility

- All existing `aria-hidden`, `data-testid`, label/input associations, and keyboard navigation remain unchanged.
- Decorative elements (pins, tape, doodles) are purely visual CSS — they have no semantic markup and do not interfere with screen readers.
- Input focus styles change from `border-color` to `border-bottom-color` on the dashed underline (using the same `#4ecdc4` teal or switching to the project's primary orange `#d4834a`).

### Testing

The existing `AuthOverlay` test file (if present) and the e2e tests in `auth.e2e.ts` should continue to pass unchanged since no behavioral contracts change.

New unit tests for the visual restyling:

- Cork board frame renders with correct `data-testid`.
- Post-it header renders with correct title text per view.
- Sticker tabs render and the active tab matches the current view.
- Form card renders with pushpin elements.
- Index card renders for key reveal views.

These tests follow the existing pattern: Vitest browser mode, `render()` from `vitest-browser-svelte`, Testing Library-style locators.
