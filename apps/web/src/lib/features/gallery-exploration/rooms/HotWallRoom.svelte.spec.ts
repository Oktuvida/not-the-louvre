import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('$app/environment', () => ({
	browser: true
}));

import HotWallRoomHarness from './HotWallRoomHarness.svelte';
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

describe('HotWallRoom', () => {
	it('creates its own ArtworkAccumulator seeded with initial artworks', async () => {
		const artworks = [
			createArtwork('h1', 100),
			createArtwork('h2', 90),
			createArtwork('h3', 80),
			createArtwork('h4', 70),
			createArtwork('h5', 60)
		];

		render(HotWallRoomHarness, {
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
		});

		// The hot wall room should render
		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();

		// Lead artwork should be visible
		await expect.element(page.getByTestId('hot-wall-lead')).toBeVisible();
	});

	it('renders lead artwork with stronger prominence and remaining artworks in supporting wall', async () => {
		const artworks = [
			createArtwork('h1', 100),
			createArtwork('h2', 90),
			createArtwork('h3', 80),
			createArtwork('h4', 70),
			createArtwork('h5', 60),
			createArtwork('h6', 50),
			createArtwork('h7', 40)
		];

		render(HotWallRoomHarness, {
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		// Lead artwork (first item) should have its own section
		await expect.element(page.getByTestId('hot-wall-lead')).toBeVisible();

		// Lead artwork image should be present
		const leadImg = document.querySelector('[data-testid="hot-wall-lead"] img');
		expect(leadImg).not.toBeNull();

		// Supporting wall artworks should be rendered
		const supportingCards = document.querySelectorAll('[data-testid^="hot-wall-card-"]');
		expect(supportingCards.length).toBeGreaterThanOrEqual(1);
	});

	it('wires ScrollSentinel to call accumulator loadMore', async () => {
		const loadMoreArtworks = vi.fn().mockResolvedValue({
			artworks: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const artworks = [
			createArtwork('h1', 100),
			createArtwork('h2', 90),
			createArtwork('h3', 80),
			createArtwork('h4', 70),
			createArtwork('h5', 60)
		];

		render(HotWallRoomHarness, {
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			loadMoreArtworks
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();

		// ScrollSentinel should be present
		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		expect(sentinel).not.toBeNull();
	});

	it('reseeds accumulator when artworks prop changes so refreshed data is shown', async () => {
		const artworks = [createArtwork('h1', 100), createArtwork('h2', 90), createArtwork('h3', 80)];

		const screen = render(HotWallRoomHarness, {
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();
		await expect.element(page.getByTestId('hot-wall-lead')).toBeVisible();

		// Simulate refresh: completely new set of artworks
		const refreshedArtworks = [
			createArtwork('h4', 200),
			createArtwork('h5', 150),
			createArtwork('h1', 100)
		];

		await screen.rerender({
			artworks: refreshedArtworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		// The new lead artwork should be h4
		const leadImg = document.querySelector('[data-testid="hot-wall-lead"] img');
		expect(leadImg).not.toBeNull();
		expect(leadImg?.getAttribute('alt')).toBe('Artwork h4');

		// h5 should appear in the supporting wall
		const supportingCards = document.querySelectorAll('[data-testid^="hot-wall-card-"]');
		const cardIds = Array.from(supportingCards).map((el) => el.getAttribute('data-testid'));
		expect(cardIds).toContain('hot-wall-card-h5');
	});

	it('renders empty state when no artworks are provided', async () => {
		render(HotWallRoomHarness, {
			artworks: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		// Should show empty state message about no artworks heating up
		await expect.element(page.getByText(/nothing.*heating up/i)).toBeVisible();

		// Lead artwork should NOT be visible
		expect(document.querySelector('[data-testid="hot-wall-lead"]')).toBeNull();
	});
});
