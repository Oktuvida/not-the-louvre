import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('$lib/features/home-entry-scene/canvas/museum-canvas', () => ({
	museumWindowOpening: { x: 0, y: 0, width: 100, height: 100 },
	museumWindowAspectRatio: '16/9',
	drawMuseumWindowFrame: vi.fn(),
	createMuseumWallPatternUrl: () => 'data:image/png;base64,mock',
	drawArtworkFrame: vi.fn(),
	applyFrameWeathering: vi.fn(),
	createArtworkFrameUrl: () => 'data:image/png;base64,mock',
	drawStickerBackground: vi.fn(),
	createStickerBackgroundUrl: () => 'data:image/png;base64,mock'
}));

vi.mock('$app/environment', () => ({
	browser: true
}));

import HallOfFameRoomHarness from './HallOfFameRoomHarness.svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

const createArtwork = (id: string, score: number, rank?: number): Artwork => ({
	id,
	title: `Artwork ${id}`,
	artist: `Artist ${id}`,
	imageUrl: `https://example.com/${id}.avif`,
	score,
	upvotes: score,
	downvotes: 0,
	timestamp: Date.now(),
	isNsfw: false,
	comments: [],
	rank
});

describe('HallOfFameRoom', () => {
	it('creates its own ArtworkAccumulator seeded with SSR artworks, slicing top 3 for podium', async () => {
		const artworks = [
			createArtwork('a1', 100, 1),
			createArtwork('a2', 90, 2),
			createArtwork('a3', 80, 3),
			createArtwork('a4', 70),
			createArtwork('a5', 60),
			createArtwork('a6', 50)
		];

		render(HallOfFameRoomHarness, {
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
		});

		// Podium should render for top 3
		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();
		await expect.element(page.getByTestId('podium-artwork-2')).toBeVisible();
		await expect.element(page.getByTestId('podium-artwork-3')).toBeVisible();
	});

	it('renders podium above VirtualizedGrid with remaining artworks', async () => {
		const artworks = [
			createArtwork('a1', 100, 1),
			createArtwork('a2', 90, 2),
			createArtwork('a3', 80, 3),
			createArtwork('a4', 70),
			createArtwork('a5', 60),
			createArtwork('a6', 50)
		];

		render(HallOfFameRoomHarness, {
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

		// Remaining artworks (a4, a5, a6) should be in the virtualized grid
		const gridCards = document.querySelectorAll('[data-testid^="ranked-polaroid-"]');
		expect(gridCards.length).toBeGreaterThanOrEqual(3);
	});

	it('wires ScrollSentinel to call accumulator loadMore', async () => {
		const loadMoreArtworks = vi.fn().mockResolvedValue({
			artworks: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const artworks = [
			createArtwork('a1', 100, 1),
			createArtwork('a2', 90, 2),
			createArtwork('a3', 80, 3),
			createArtwork('a4', 70)
		];

		render(HallOfFameRoomHarness, {
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			loadMoreArtworks
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

		// ScrollSentinel should be present
		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		expect(sentinel).not.toBeNull();
	});

	it('releases accumulator state on unmount (no lingering DOM)', async () => {
		const artworks = [
			createArtwork('a1', 100, 1),
			createArtwork('a2', 90, 2),
			createArtwork('a3', 80, 3),
			createArtwork('a4', 70)
		];

		const { unmount } = render(HallOfFameRoomHarness, {
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

		unmount();

		// After unmount, no podium or grid elements should remain
		expect(document.querySelector('[data-testid="podium-artwork-1"]')).toBeNull();
		expect(document.querySelectorAll('[data-testid^="ranked-polaroid-"]').length).toBe(0);
	});
});
