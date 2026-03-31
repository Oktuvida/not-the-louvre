# Mystery Room Film Reel Redesign

**Date:** 2025-03-31
**Status:** Approved

## Summary

Replace the Mystery Room's static card-with-spin UI with an animated horizontal film reel that continuously scrolls through artworks. The center frame is sharp and prominent; side frames progressively scale down, blur, and fade. A "Spin!" button accelerates the reel like a fortune wheel and, when it stops, automatically opens the ArtworkDetailPanel.

## Design Decisions

| Decision | Choice |
|---|---|
| Direction | Horizontal (left to right) |
| Aesthetic | Film strip with sprocket holes, dark background |
| Side treatment | Scale + blur + opacity fade (depth/magnifying-lens feel) |
| Spin feel | Accelerate fast → long smooth deceleration (fortune wheel) |
| After spin stops | Auto-open ArtworkDetailPanel |
| Idle speed | Slow contemplative drift (~5s per frame) |
| Animation engine | CSS transforms driven by GSAP (already in project) |

## Architecture

```
MysteryRoom.svelte (rewritten)
├── FilmReel.svelte          ← NEW component
│   ├── Film strip container (overflow: hidden)
│   ├── Track div (translateX animated by GSAP)
│   ├── Film frames (artwork images with per-frame scale/blur/opacity)
│   ├── Sprocket holes (top + bottom rows)
│   └── Edge fade gradients (left + right)
├── SpinButton               ← reuses GameButton
└── ArtworkDetailPanel        ← existing, auto-opens on spin stop
```

## State Machine

```
IDLE → (click SPIN) → SPINNING → (stopped) → REVEAL → (close panel) → IDLE
```

- **IDLE**: Reel drifts slowly left, looping through artworks (~5s per frame)
- **SPINNING**: GSAP accelerates the reel, then decelerates with `power4.out` over ~4s
- **REVEAL**: ArtworkDetailPanel opens automatically for the landed artwork

## Animation Strategy (GSAP)

- **Idle**: Continuous `translateX` animation with `ease: "none"`, `repeat: -1`. On each repeat cycle, recycle frames that exited the left edge back to the right.
- **Spin**: Kill the idle tween, calculate a random target artwork, and `gsap.to(track, { x: targetX, duration: ~4s, ease: "power4.out" })`.
- **Per-frame effects**: A reactive `$effect` computes each frame's distance from viewport center and applies `transform: scale()`, `opacity`, and `filter: blur()` proportionally.

## Props Interface Change

**Before:**
```typescript
{ artwork: Artwork; onReveal: () => void; onSelect: (artwork: Artwork) => void; }
```

**After:**
```typescript
{ artworks: Artwork[]; onSelect: (artwork: Artwork) => void; }
```

The parent no longer manages `mysteryIndex`. The FilmReel picks a random target internally on spin.

## Visual Details

- Film strip background: `#111` / near-black
- Sprocket holes: small rounded rectangles in `#2a2a2a`
- Center frame border: `#c9a96e` (gold) with box-shadow glow
- Edge fade: CSS gradient overlays from strip background to transparent
- Spin button: existing `GameButton variant="danger" size="hero"`
