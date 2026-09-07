import { describe, expect, it, vi } from 'vitest';
import { makeArtwork } from '$lib/features/gallery-exploration/fixtures/artworks';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import { createArtworkAccumulator } from './artwork-accumulator.svelte';

const makeIndexedArtwork = (index: number): Artwork =>
	makeArtwork({
		artist: `artist-${index}`,
		authorId: 'user-test',
		id: `artwork-${index}`,
		imageUrl: `/api/artworks/artwork-${index}/media`,
		score: index,
		timestamp: 1_700_000_000_000 - index * 1000,
		title: `Artwork ${index}`
	});

describe('createArtworkAccumulator', () => {
	it('initializes with artworks and pageInfo', () => {
		const initial = Array.from({ length: 5 }, (_, i) => makeIndexedArtwork(i + 1));
		const acc = createArtworkAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn()
		});

		expect(acc.allArtworks).toHaveLength(5);
		expect(acc.hasMore).toBe(true);
		expect(acc.isLoading).toBe(false);
		expect(acc.error).toBeNull();
		expect(acc.pageInfo).toEqual({ hasMore: true, nextCursor: 'cursor-1' });
	});

	it('loadMore appends fetched artworks deduplicated by ID and updates cursor', async () => {
		const initial = Array.from({ length: 3 }, (_, i) => makeIndexedArtwork(i + 1));
		const nextPage = [makeIndexedArtwork(3), makeIndexedArtwork(4), makeIndexedArtwork(5)]; // artwork-3 is a dupe

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: nextPage,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const acc = createArtworkAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage
		});

		await acc.loadMore();

		expect(fetchPage).toHaveBeenCalledWith('cursor-1');
		expect(acc.allArtworks).toHaveLength(5); // 3 initial + 2 new (artwork-3 deduped)
		expect(acc.allArtworks.map((a) => a.id)).toEqual([
			'artwork-1',
			'artwork-2',
			'artwork-3',
			'artwork-4',
			'artwork-5'
		]);
		expect(acc.hasMore).toBe(false);
	});

	it('loadMore is a no-op when isLoading is true', async () => {
		const fetchPage = vi.fn().mockImplementation(
			() => new Promise(() => {}) // never resolves
		);

		const acc = createArtworkAccumulator({
			initialArtworks: [makeIndexedArtwork(1)],
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage
		});

		// Start first load (hangs)
		const firstLoad = acc.loadMore();
		// Try to load again
		await acc.loadMore();

		expect(fetchPage).toHaveBeenCalledTimes(1);

		// Cleanup — we don't await firstLoad since it never resolves
		void firstLoad;
	});

	it('loadMore is a no-op when hasMore is false', async () => {
		const fetchPage = vi.fn();

		const acc = createArtworkAccumulator({
			initialArtworks: [makeIndexedArtwork(1)],
			initialPageInfo: { hasMore: false, nextCursor: null },
			fetchPage
		});

		await acc.loadMore();

		expect(fetchPage).not.toHaveBeenCalled();
	});

	it('stops paging once the catalog is exhausted', async () => {
		const initial = Array.from({ length: 5 }, (_, i) => makeIndexedArtwork(i + 1));
		const lastPage = Array.from({ length: 3 }, (_, i) => makeIndexedArtwork(i + 6));

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: lastPage,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const acc = createArtworkAccumulator({
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

	it('exposes a flat artwork list with no row grouping', () => {
		const acc = createArtworkAccumulator({
			initialArtworks: Array.from({ length: 7 }, (_, i) => makeIndexedArtwork(i + 1)),
			initialPageInfo: { hasMore: false, nextCursor: null },
			fetchPage: vi.fn()
		});

		expect(Array.isArray(acc.allArtworks)).toBe(true);
		expect(acc.allArtworks).toHaveLength(7);
		for (const item of acc.allArtworks) {
			expect(item).toHaveProperty('id');
			expect(item).toHaveProperty('title');
		}
	});

	it('sets error when fetch fails and retry re-attempts the same cursor', async () => {
		const fetchPage = vi
			.fn()
			.mockRejectedValueOnce(new Error('Network error'))
			.mockResolvedValueOnce({
				artworks: [makeIndexedArtwork(2)],
				pageInfo: { hasMore: false, nextCursor: null }
			});

		const acc = createArtworkAccumulator({
			initialArtworks: [makeIndexedArtwork(1)],
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage
		});

		await acc.loadMore();

		expect(acc.error).toBe('Network error');
		expect(acc.isLoading).toBe(false);
		expect(acc.hasMore).toBe(true);

		await acc.retry();

		expect(fetchPage).toHaveBeenCalledTimes(2);
		expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor-1'); // same cursor
		expect(acc.error).toBeNull();
		expect(acc.allArtworks).toHaveLength(2);
		expect(acc.hasMore).toBe(false);
	});

	it('reseed replaces the base artworks and pageInfo', async () => {
		const acc = createArtworkAccumulator({
			initialArtworks: [makeIndexedArtwork(1), makeIndexedArtwork(2)],
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn()
		});

		acc.reseed([makeIndexedArtwork(10)], { hasMore: false, nextCursor: null });

		expect(acc.allArtworks.map((artwork) => artwork.id)).toEqual(['artwork-10']);
		expect(acc.hasMore).toBe(false);
		expect(acc.error).toBeNull();
	});

	it('reseed drops pages fetched after the previous seed', async () => {
		const acc = createArtworkAccumulator({
			initialArtworks: [makeIndexedArtwork(1)],
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn().mockResolvedValueOnce({
				artworks: [makeIndexedArtwork(2)],
				pageInfo: { hasMore: false, nextCursor: null }
			})
		});

		await acc.loadMore();
		expect(acc.allArtworks).toHaveLength(2);

		acc.reseed([makeIndexedArtwork(3)], { hasMore: true, nextCursor: 'cursor-2' });

		expect(acc.allArtworks.map((artwork) => artwork.id)).toEqual(['artwork-3']);
		expect(acc.pageInfo).toEqual({ hasMore: true, nextCursor: 'cursor-2' });
	});

	it('syncs seed artwork metadata without dropping appended artworks', async () => {
		const acc = createArtworkAccumulator({
			initialArtworks: [makeIndexedArtwork(1)],
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn().mockResolvedValueOnce({
				artworks: [makeIndexedArtwork(2)],
				pageInfo: { hasMore: false, nextCursor: null }
			})
		});

		await acc.loadMore();
		acc.syncSeedArtworks([{ ...makeIndexedArtwork(1), commentCount: 7, score: 99, upvotes: 99 }]);

		expect(acc.allArtworks).toHaveLength(2);
		expect(acc.allArtworks[0]).toMatchObject({
			commentCount: 7,
			score: 99,
			upvotes: 99,
			id: 'artwork-1'
		});
		expect(acc.allArtworks[1].id).toBe('artwork-2');
	});
});
