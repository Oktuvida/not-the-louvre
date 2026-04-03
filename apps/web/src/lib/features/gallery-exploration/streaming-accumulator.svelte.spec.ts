import { describe, expect, it, vi } from 'vitest';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import { createStreamingAccumulator } from './streaming-accumulator.svelte';

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

describe('createStreamingAccumulator', () => {
	it('reseed replaces internal state with provided artworks and pageInfo', () => {
		const acc = createStreamingAccumulator({
			initialArtworks: [makeArtwork(1), makeArtwork(2)],
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn()
		});

		expect(acc.allArtworks).toHaveLength(2);

		acc.reseed([makeArtwork(10), makeArtwork(11), makeArtwork(12)], {
			hasMore: false,
			nextCursor: null
		});

		expect(acc.allArtworks.map((a) => a.id)).toEqual(['artwork-10', 'artwork-11', 'artwork-12']);
		expect(acc.hasMore).toBe(false);
		expect(acc.isLoading).toBe(false);
		expect(acc.error).toBeNull();
	});

	it('loadMore appends artworks without eviction and deduplicates by ID', async () => {
		const initial = Array.from({ length: 5 }, (_, i) => makeArtwork(i + 1));
		// Page contains 2 duplicates (artwork-4, artwork-5) and 3 new
		const nextPage = [
			makeArtwork(4),
			makeArtwork(5),
			makeArtwork(6),
			makeArtwork(7),
			makeArtwork(8)
		];

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: nextPage,
			pageInfo: { hasMore: true, nextCursor: 'cursor-2' }
		});

		const acc = createStreamingAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage
		});

		await acc.loadMore();

		// 5 initial + 3 new (deduped) = 8
		expect(acc.allArtworks).toHaveLength(8);
		expect(acc.allArtworks.map((a) => a.id)).toEqual([
			'artwork-1',
			'artwork-2',
			'artwork-3',
			'artwork-4',
			'artwork-5',
			'artwork-6',
			'artwork-7',
			'artwork-8'
		]);
		expect(acc.hasMore).toBe(true);
	});

	it('progress reports fraction of pool consumed (0-1)', () => {
		const initial = Array.from({ length: 10 }, (_, i) => makeArtwork(i + 1));

		const acc = createStreamingAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn()
		});

		// Initially progress is 0
		expect(acc.progress).toBe(0);

		// Set progress to 50%
		acc.setProgress(0.5);
		expect(acc.progress).toBe(0.5);

		// Set progress to 100%
		acc.setProgress(1);
		expect(acc.progress).toBe(1);
	});

	it('allArtworks returns a flat array (no row grouping)', () => {
		const initial = Array.from({ length: 7 }, (_, i) => makeArtwork(i + 1));

		const acc = createStreamingAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: false, nextCursor: null },
			fetchPage: vi.fn()
		});

		const artworks = acc.allArtworks;

		expect(Array.isArray(artworks)).toBe(true);
		expect(artworks).toHaveLength(7);
		// Every element is an Artwork, not an array
		for (const item of artworks) {
			expect(item).toHaveProperty('id');
			expect(item).toHaveProperty('title');
		}
	});

	it('handles exhaustion — hasMore is false after all pages loaded', async () => {
		const initial = Array.from({ length: 5 }, (_, i) => makeArtwork(i + 1));
		const lastPage = Array.from({ length: 3 }, (_, i) => makeArtwork(i + 6));

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: lastPage,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const acc = createStreamingAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage
		});

		expect(acc.hasMore).toBe(true);

		await acc.loadMore();

		expect(acc.hasMore).toBe(false);
		expect(acc.allArtworks).toHaveLength(8);

		// Calling loadMore again should be a no-op
		await acc.loadMore();
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});

	it('retry clears error and retries loadMore', async () => {
		const fetchPage = vi
			.fn()
			.mockRejectedValueOnce(new Error('Network failure'))
			.mockResolvedValueOnce({
				artworks: [makeArtwork(6)],
				pageInfo: { hasMore: false, nextCursor: null }
			});

		const acc = createStreamingAccumulator({
			initialArtworks: [makeArtwork(1)],
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage
		});

		// First loadMore fails
		await acc.loadMore();
		expect(acc.error).toBe('Network failure');
		expect(acc.allArtworks).toHaveLength(1);

		// Retry clears error and succeeds
		await acc.retry();
		expect(acc.error).toBeNull();
		expect(acc.allArtworks).toHaveLength(2);
		expect(acc.hasMore).toBe(false);
	});
});
