import type { CacheSnapshot } from 'virtua';

// The grid's geometry lives in gallery-grid.css; this is what a grid keeps of
// its layout while its room is away.

/** A grid's measured rows, to mount it again exactly as it was laid out. */
export type GridLayoutSnapshot = {
	cache: CacheSnapshot;
	columnCount: number;
	rowCount: number;
};
