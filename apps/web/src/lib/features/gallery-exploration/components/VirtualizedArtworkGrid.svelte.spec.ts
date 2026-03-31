import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import VirtualizedArtworkGrid from './VirtualizedArtworkGrid.svelte';

const makeArtwork = (index: number): Artwork => ({
	artist: `artist-${index}`,
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	id: `artwork-${index}`,
	imageUrl: `/api/artworks/artwork-${index}/media`,
	isNsfw: false,
	score: index,
	timestamp: Date.now() - index * 1000,
	title: `Artwork ${index}`,
	upvotes: 0,
	viewerVote: null
});

const initialArtworks = Array.from({ length: 24 }, (_, index) => makeArtwork(index + 1));
const nextArtworks = Array.from({ length: 12 }, (_, index) => makeArtwork(index + 25));

describe('VirtualizedArtworkGrid', () => {
	beforeEach(() => {
		window.scrollTo(0, 0);
	});

	it('loads the next discovery segment when scrolling near the loaded range end', async () => {
		const loadMoreArtworks = vi.fn(async () => ({
			artworks: nextArtworks,
			pageInfo: { hasMore: false, nextCursor: null }
		}));

		render(VirtualizedArtworkGrid, {
			artworks: initialArtworks,
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
				request: {
					authorId: 'user-1',
					limit: 24,
					sort: 'recent',
					window: null
				}
			},
			loadMoreArtworks,
			onSelect: vi.fn()
		});

		window.scrollTo(0, 10000);
		window.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => {
			expect(loadMoreArtworks).toHaveBeenCalledWith({
				authorId: 'user-1',
				cursor: 'cursor-1',
				limit: 24,
				sort: 'recent',
				window: null
			});
		});

		await expect.element(page.getByTestId('virtualized-artwork-card-artwork-25')).toBeVisible();
		await expect.element(page.getByTestId('virtualized-artwork-card-artwork-36')).toBeVisible();
	});

	it('appends only new artworks across sequential continuation loads', async () => {
		const loadMoreArtworks = vi
			.fn()
			.mockResolvedValueOnce({
				artworks: nextArtworks,
				pageInfo: { hasMore: true, nextCursor: 'cursor-2' }
			})
			.mockResolvedValueOnce({
				artworks: [
					...nextArtworks.slice(6),
					...Array.from({ length: 6 }, (_, index) => makeArtwork(index + 37))
				],
				pageInfo: { hasMore: false, nextCursor: null }
			});

		render(VirtualizedArtworkGrid, {
			artworks: initialArtworks,
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
				request: {
					authorId: 'user-1',
					limit: 24,
					sort: 'recent',
					window: null
				}
			},
			loadMoreArtworks,
			onSelect: vi.fn()
		});

		window.scrollTo(0, 10000);
		window.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => {
			expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
		});

		window.scrollTo(0, 20000);
		window.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => {
			expect(loadMoreArtworks).toHaveBeenCalledTimes(2);
		});

		await vi.waitFor(() => {
			expect(
				document.querySelectorAll('[data-testid="virtualized-artwork-card-artwork-31"]').length
			).toBe(1);
			expect(document.querySelector('[data-testid="virtualized-gallery-loading-more"]')).toBeNull();
		});
		expect(loadMoreArtworks.mock.calls[1]?.[0]).toMatchObject({ cursor: 'cursor-2' });
	});

	it('keeps the number of mounted cards bounded while scrolling', async () => {
		render(VirtualizedArtworkGrid, {
			artworks: Array.from({ length: 120 }, (_, index) => makeArtwork(index + 1)),
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: null
			},
			onSelect: vi.fn()
		});

		await vi.waitFor(() => {
			expect(
				document.querySelectorAll('[data-testid^="virtualized-artwork-card-"]').length
			).toBeLessThan(40);
		});

		window.scrollTo(0, 12000);
		window.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => {
			expect(
				document.querySelector('[data-testid="virtualized-artwork-card-artwork-1"]')
			).toBeNull();
		});
	});

	it('recreates previously seen cards when the user scrolls back', async () => {
		render(VirtualizedArtworkGrid, {
			artworks: Array.from({ length: 120 }, (_, index) => makeArtwork(index + 1)),
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: null
			},
			onSelect: vi.fn()
		});

		window.scrollTo(0, 12000);
		window.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => {
			expect(
				document.querySelector('[data-testid="virtualized-artwork-card-artwork-1"]')
			).toBeNull();
		});

		window.scrollTo(0, 0);
		window.dispatchEvent(new Event('scroll'));

		await expect.element(page.getByTestId('virtualized-artwork-card-artwork-1')).toBeVisible();
	});
});
