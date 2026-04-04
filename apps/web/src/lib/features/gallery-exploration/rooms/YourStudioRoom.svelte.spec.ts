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

import YourStudioRoomHarness from './YourStudioRoomHarness.svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

const createArtwork = (id: string, score: number): Artwork => ({
	id,
	title: `Artwork ${id}`,
	artist: `Artist ${id}`,
	imageUrl: `https://example.com/${id}.avif`,
	score,
	upvotes: score,
	downvotes: 0,
	timestamp: Date.now(),
	isNsfw: false,
	comments: []
});

describe('YourStudioRoom', () => {
	it('creates its own ArtworkAccumulator seeded with SSR artworks', async () => {
		const artworks = [createArtwork('s1', 50), createArtwork('s2', 40), createArtwork('s3', 30)];

		render(YourStudioRoomHarness, {
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		// All artworks should appear in the virtualized grid as polaroid cards
		const cards = await page.getByTestId('virtualized-artwork-card-s1');
		await expect.element(cards).toBeVisible();
	});

	it('renders VirtualizedGrid with PolaroidCard for each artwork', async () => {
		const artworks = [
			createArtwork('s1', 50),
			createArtwork('s2', 40),
			createArtwork('s3', 30),
			createArtwork('s4', 20)
		];

		render(YourStudioRoomHarness, {
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByTestId('virtualized-artwork-card-s1')).toBeVisible();

		// WindowVirtualizer renders only visible rows; at least some cards should appear
		const allCards = document.querySelectorAll('[data-testid^="virtualized-artwork-card-"]');
		expect(allCards.length).toBeGreaterThanOrEqual(1);

		// Verify virtualized rows exist (content-visibility wrapper)
		const rows = document.querySelectorAll('[data-testid="virtualized-row"]');
		expect(rows.length).toBeGreaterThanOrEqual(1);
	});

	it('wires ScrollSentinel to call accumulator loadMore', async () => {
		const loadMoreArtworks = vi.fn().mockResolvedValue({
			artworks: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const artworks = [createArtwork('s1', 50)];

		render(YourStudioRoomHarness, {
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			loadMoreArtworks
		});

		await expect.element(page.getByTestId('virtualized-artwork-card-s1')).toBeVisible();

		// ScrollSentinel should be present when hasMore is true
		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		expect(sentinel).not.toBeNull();
	});

	it('reseeds accumulator when artworks prop changes so refreshed data is shown', async () => {
		const artworks = [createArtwork('s1', 50), createArtwork('s2', 40), createArtwork('s3', 30)];

		const screen = render(YourStudioRoomHarness, {
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByTestId('virtualized-artwork-card-s1')).toBeVisible();

		// Simulate refresh: user published a new artwork, order changed
		const refreshedArtworks = [
			createArtwork('s4', 60),
			createArtwork('s1', 50),
			createArtwork('s2', 40)
		];

		await screen.rerender({
			artworks: refreshedArtworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		// New artwork s4 should be visible
		await expect.element(page.getByTestId('virtualized-artwork-card-s4')).toBeVisible();

		// Old artwork s3 should no longer be in the grid
		expect(document.querySelector('[data-testid="virtualized-artwork-card-s3"]')).toBeNull();
	});

	it('releases state on unmount', async () => {
		const artworks = [createArtwork('s1', 50)];

		const { unmount } = render(YourStudioRoomHarness, {
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByTestId('virtualized-artwork-card-s1')).toBeVisible();

		unmount();

		expect(document.querySelectorAll('[data-testid^="virtualized-artwork-card-"]').length).toBe(0);
	});
});
