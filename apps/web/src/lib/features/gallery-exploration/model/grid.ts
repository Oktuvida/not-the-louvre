/*
 * Grid geometry for the gallery feed.
 *
 * VirtualizedGrid measures the container and chunks rows from these numbers;
 * every placeholder that stands in for the grid (the streamed room skeleton,
 * the infinite-scroll skeleton) has to reserve the same boxes or the hand-off
 * from skeleton to content becomes a reflow. Keeping the two in one module is
 * what stops them drifting apart again.
 */

/** Gap between grid cells, in pixels (matches Tailwind's `gap-12`). */
export const GALLERY_GRID_GAP = 48;

/** Minimum column width, in pixels, used by the auto-fill fallback. */
export const GALLERY_GRID_MIN_COLUMN_WIDTH = 280;

/** The auto-fill template the grid falls back to before it is measured. */
export const GALLERY_GRID_TEMPLATE_COLUMNS = `repeat(auto-fill, minmax(${GALLERY_GRID_MIN_COLUMN_WIDTH}px, 1fr))`;
