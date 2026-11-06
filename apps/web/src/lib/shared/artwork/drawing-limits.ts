/*
 * What one drawing may hold: the studio's ink runs out here and the server
 * refuses past it. Three times what the old Rust runtime allowed, so a pen at
 * full speed for most of an hour still fits; only a document built to break
 * the system reaches it.
 */

export type DrawingLimits = {
	maxCompressedBytes: number;
	maxDecompressedBytes: number;
	maxPointsPerStroke: number;
	maxStrokes: number;
	maxTotalPoints: number;
};

const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

export const DRAWING_LIMITS: DrawingLimits = {
	// Gzip barely grows what it cannot shrink, so the compressed cap sits just
	// above the document cap: it stops a payload that is not a drawing, never a
	// drawing that compresses badly (the old 256 KiB cap could refuse a drawing
	// the ink still allowed).
	maxCompressedBytes: MAX_DOCUMENT_BYTES + 64 * 1024,
	maxDecompressedBytes: MAX_DOCUMENT_BYTES,
	maxPointsPerStroke: 15_000,
	maxStrokes: 15_000,
	maxTotalPoints: 300_000
};
