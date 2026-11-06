import { describe, expect, it } from 'vitest';
import {
	HANDOFF_COVER_ASPECT,
	SIDE_TABLE_BOOK,
	SIDE_TABLE_BOOK_STRETCH,
	handoffBookRect,
	handoffZoom
} from './studio-handoff';

// Both pages place the closed sketchbook in the same rectangle, worked out
// from the window alone: the 3D camera ends its move with the side table's
// book there, and the studio opens with its own book there.

const windows = [
	{ height: 860, width: 1512 },
	{ height: 1080, width: 1920 },
	{ height: 800, width: 1280 },
	{ height: 768, width: 1024 },
	{ height: 1440, width: 3440 }
];

describe('the sketchbook hand-off', () => {
	for (const { height, width } of windows) {
		it(`keeps the closed book whole and centred on a ${width}×${height} window`, () => {
			const rect = handoffBookRect(width, height);

			expect(rect.cx - rect.width / 2).toBeGreaterThan(0);
			expect(rect.cx + rect.width / 2).toBeLessThan(width);
			expect(rect.cy - rect.height / 2).toBeGreaterThan(0);
			expect(rect.cy + rect.height / 2).toBeLessThan(height);
			expect(rect.cx).toBe(width / 2);
			expect(rect.width / rect.height).toBeCloseTo(HANDOFF_COVER_ASPECT, 6);
		});
	}

	it('zooms the 3D camera so the side table’s book is exactly as tall as the closed book', () => {
		const rect = handoffBookRect(1512, 860);
		const pixelsPerUnit = handoffZoom(rect);

		expect((SIDE_TABLE_BOOK.height / 450) * pixelsPerUnit).toBeCloseTo(rect.height, 6);
	});

	it('draws the 3D book wide enough for its cover to have the studio cover’s shape', () => {
		const stretchedAspect =
			(SIDE_TABLE_BOOK.width * SIDE_TABLE_BOOK_STRETCH) / SIDE_TABLE_BOOK.height;

		expect(stretchedAspect).toBeCloseTo(HANDOFF_COVER_ASPECT, 6);
	});
});
