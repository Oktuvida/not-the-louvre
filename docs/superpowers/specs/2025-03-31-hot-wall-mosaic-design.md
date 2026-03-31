# Hot Wall Mosaic Redesign

**Date:** 2025-03-31
**Status:** Design

## Problem

The current Hot Wall room has a forced two-column hero layout (lead artwork + "Why it is hot" sidebar), cluttered information panels, a heavy brown/red color palette with thick borders, and does not visually communicate the "hot wall" concept. It feels overdesigned and text-heavy for what should be a visual showcase of trending artworks.

## Solution

Replace the current layout with an asymmetric **mosaic wall** where artwork size communicates heat rank. The hottest artwork dominates the center. A warm-to-cool color gradient on tile glows reinforces the heat metaphor without text. The "Why it is hot" sidebar, explanatory copy, "Still climbing" section, and stat badges are all removed.

## Layout

### Featured Mosaic (Top 5)

A CSS grid with 3 columns and 2 rows. All artworks are square.

```
┌──────────┬────────────────────┬──────────┐
│          │                    │          │
│    #2    │                    │    #3    │
│          │        #1          │          │
├──────────┤   (spans 2 rows)   ├──────────┤
│          │                    │          │
│    #4    │                    │    #5    │
│          │                    │          │
└──────────┴────────────────────┴──────────┘
```

- **Grid definition:** `grid-template-columns: 1fr 1.8fr 1fr` with `grid-template-rows: 1fr 1fr`.
- **#1 tile:** `grid-row: span 2`. Largest tile, warm red glow.
- **#2–#5 tiles:** Fill the four corners. Progressively cooler glow.
- **Gap:** `12px` between tiles.
- **Responsive:** On mobile (`< md`), collapse to a single column stack ordered #1, #2, #3, #4, #5 with #1 larger than the rest.

### Overflow Grid (6th place onward)

When more than 5 artworks exist, render #6+ as `PolaroidCard` components in a responsive grid below the mosaic:

- `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` with `gap-12`.
- Deterministic vertical offset per card (same approach as Your Studio room) for organic scattered feel.
- No heat glow on PolaroidCards — they are "off the wall."

### Edge Cases

- **1 artwork:** Single tile fills the space, centered. No grid.
- **2–4 artworks:** Adapt the grid — #1 always spans 2 rows in the center column. Empty corners are not rendered; the grid adjusts column/row definitions to avoid gaps.
- **0 artworks:** Handled by the parent `GalleryExplorationPage` empty state (unchanged).

## Tile Design

Each featured tile is a plain framed square:

- **Background:** `#f8f4ed` (cream, matches design token `--color-paper`).
- **Border:** `border-3 border-[#2d2420]` for #2–#5, `border-4 border-[#2d2420]` for #1.
- **Border radius:** `rounded-lg` (~8px) for #2–#5, slightly larger for #1.
- **Image:** Square, `object-cover`, fills the tile with small padding.
- **Hover:** `scale(1.03)` with `transition duration-200`.
- **Click:** Calls `onSelect(artwork)` to open the detail panel.

### Heat Glow

A `box-shadow` glow applied to each tile, transitioning from the room's red accent to the app's sage green secondary:

| Rank | Glow color | Shadow |
|------|-----------|--------|
| #1 | `rgba(200, 79, 79, 0.35)` | `0 0 28px` |
| #2 | `rgba(200, 120, 60, 0.25)` | `0 0 16px` |
| #3 | `rgba(180, 140, 80, 0.20)` | `0 0 12px` |
| #4 | `rgba(140, 150, 130, 0.18)` | `0 0 8px` |
| #5 | `rgba(113, 145, 127, 0.15)` | `0 0 6px` |

For #6+ (PolaroidCards), no glow is applied.

### Info Visibility

- **#1 tile only:** Always shows title, artist, and score in a gradient overlay at the bottom of the tile (`linear-gradient(transparent, rgba(45,36,32,0.85))`). The "Hottest" label appears in gold (`#f4c430`) above the title.
- **#2–#5 tiles:** No visible info. Click opens detail panel.
- **PolaroidCards (#6+):** Show their standard caption (title, artist, score) as PolaroidCard already handles this.

## NSFW Handling

Same as current implementation: when `adultContentEnabled` is false and `artwork.isNsfw` is true, the artwork image is blurred (`blur-xl saturate-0 scale-[1.04]`) with a dark overlay showing an "18+" badge and "Sensitive artwork" text. Applied per-tile identically to the current HotWallRoom behavior.

## What Gets Removed

- The two-column `lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]` hero layout.
- The "Hot right now" label on the lead card.
- The "Rising now" pill badge.
- The entire "Why it is hot" sidebar panel (heading, explanatory copy, "Still climbing" risers list).
- The Score / Comments / Forks stat badges on the lead card.
- The `ArtworkFrame` (canvas-rendered ornate frame) usage — replaced by plain framed tiles.
- The `risers` prop — no longer needed. The parent page passes all artworks as a flat array and HotWallRoom handles the split internally.

## What Gets Added

- Heat glow box-shadows per tile.
- Bottom gradient info overlay on #1 tile.
- Adaptive grid logic for 1–4 artwork counts.

## Props Changes

### Before

```typescript
{
  adultContentEnabled?: boolean;
  gridArtworks?: Artwork[];
  leadArtwork?: Artwork | null;
  viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
  onArtworkPatch?: (artworkId: string, patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>) => void;
  onSelect?: (artwork: Artwork) => void;
  risers?: Artwork[];
}
```

### After

```typescript
{
  adultContentEnabled?: boolean;
  artworks?: Artwork[];
  onSelect?: (artwork: Artwork) => void;
}
```

- `leadArtwork`, `risers`, `gridArtworks` are replaced by a single `artworks` array (sorted by heat, #1 first). HotWallRoom splits internally: `artworks[0..4]` = mosaic, `artworks[5+]` = overflow grid.
- `viewer` and `onArtworkPatch` are removed — they were unused (lint warnings already exist for these).

### Parent Changes (GalleryExplorationPage)

- Remove `hotWallLeadArtwork`, `hotWallRisers`, `hotWallGridArtworks` derived values.
- Pass `artworks` directly to `HotWallRoom` (same as MysteryRoom now does).
- Pass `adultContentEnabled` (renamed from `adultContentAllowed` for consistency — or keep existing name, either works).

## Component Structure

No new components are introduced. `HotWallRoom.svelte` is rewritten in place. `PolaroidCard` is reused for the overflow grid.

## Testing

### Unit Tests (new file: `HotWallRoom.svelte.spec.ts`)

1. Renders the mosaic grid with 5 artworks showing artwork images.
2. Shows the #1 artwork info overlay (title, artist, score visible).
3. Does not show info for #2–#5 tiles (no title/artist text visible).
4. Calls `onSelect` when a mosaic tile is clicked.
5. Calls `onSelect` when an overflow PolaroidCard is clicked.
6. Renders overflow PolaroidCards for artworks beyond the top 5.
7. Blurs NSFW artworks when adult content is disabled.
8. Shows NSFW artworks unblurred when adult content is enabled.
9. Handles single artwork gracefully (no empty grid slots).

### Existing Tests (GalleryExplorationPage.svelte.spec.ts)

The following existing tests reference hot-wall and will need updates:

- "renders the hot wall with a featured lead artwork and supporting risers" — update assertions to match mosaic structure (remove "Hot right now" text check, update riser assertions).
- "uses polaroids for the hot wall secondary grid artworks" — update to check for mosaic tiles and overflow polaroids.
- Other hot-wall tests ("renders real discovery artwork cards," "loads and opens real artwork detail," "blurs nsfw artworks") should pass with minor selector adjustments.
