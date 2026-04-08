import { describe, expect, it, vi } from 'vitest';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import { createBoundedPoolAccumulator } from './bounded-pool-accumulator.svelte';

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

describe('createBoundedPoolAccumulator', () => {
	it('initializes with artworks and tracks pool state', () => {
		const initial = Array.from({ length: 12 }, (_, i) => makeArtwork(i + 1));
		const pool = createBoundedPoolAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn(),
			capacity: 36,
			pageSize: 12
		});

		expect(pool.allArtworks).toHaveLength(12);
		expect(pool.hasMore).toBe(true);
		expect(pool.isLoading).toBe(false);
		expect(pool.error).toBeNull();
		expect(pool.hasPendingEviction).toBe(false);
	});

	it('loadMore appends fetched artworks and marks pending eviction when pool exceeds capacity', async () => {
		// Start with 36 items (at capacity)
		const initial = Array.from({ length: 36 }, (_, i) => makeArtwork(i + 1));
		const nextPage = Array.from({ length: 12 }, (_, i) => makeArtwork(i + 37));

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: nextPage,
			pageInfo: { hasMore: true, nextCursor: 'cursor-3' }
		});

		const pool = createBoundedPoolAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-2' },
			fetchPage,
			capacity: 36,
			pageSize: 12
		});

		await pool.loadMore();

		// Pool has 48 items but eviction is pending, not applied yet
		expect(pool.allArtworks).toHaveLength(48);
		expect(pool.hasPendingEviction).toBe(true);
	});

	it('applyPendingEviction evicts oldest page to bring pool within capacity', async () => {
		const initial = Array.from({ length: 36 }, (_, i) => makeArtwork(i + 1));
		const nextPage = Array.from({ length: 12 }, (_, i) => makeArtwork(i + 37));

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: nextPage,
			pageInfo: { hasMore: true, nextCursor: 'cursor-3' }
		});

		const pool = createBoundedPoolAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-2' },
			fetchPage,
			capacity: 36,
			pageSize: 12
		});

		await pool.loadMore();
		expect(pool.hasPendingEviction).toBe(true);

		pool.applyPendingEviction();

		expect(pool.allArtworks).toHaveLength(36);
		expect(pool.hasPendingEviction).toBe(false);
		// First 12 items evicted, pool now starts at artwork-13
		expect(pool.allArtworks[0]!.id).toBe('artwork-13');
		// Last item is artwork-48
		expect(pool.allArtworks[pool.allArtworks.length - 1]!.id).toBe('artwork-48');
	});

	it('does not mark pending eviction when pool is within capacity', async () => {
		const initial = Array.from({ length: 12 }, (_, i) => makeArtwork(i + 1));
		const nextPage = Array.from({ length: 12 }, (_, i) => makeArtwork(i + 13));

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: nextPage,
			pageInfo: { hasMore: true, nextCursor: 'cursor-2' }
		});

		const pool = createBoundedPoolAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage,
			capacity: 36,
			pageSize: 12
		});

		await pool.loadMore();

		expect(pool.allArtworks).toHaveLength(24);
		expect(pool.hasPendingEviction).toBe(false);
	});

	it('after full catalog traversal (hasMore: false), no more fetches are attempted', async () => {
		const initial = Array.from({ length: 12 }, (_, i) => makeArtwork(i + 1));
		const lastPage = Array.from({ length: 6 }, (_, i) => makeArtwork(i + 13));

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: lastPage,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const pool = createBoundedPoolAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage,
			capacity: 36,
			pageSize: 12
		});

		await pool.loadMore();
		expect(pool.hasMore).toBe(false);
		expect(pool.allArtworks).toHaveLength(18);

		// Try to load more — should be a no-op
		await pool.loadMore();
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});

	it('deduplicates artworks by ID on append', async () => {
		const initial = Array.from({ length: 12 }, (_, i) => makeArtwork(i + 1));
		// Page contains some duplicates
		const nextPage = [makeArtwork(10), makeArtwork(11), makeArtwork(12), makeArtwork(13)];

		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: nextPage,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const pool = createBoundedPoolAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage,
			capacity: 36,
			pageSize: 12
		});

		await pool.loadMore();

		expect(pool.allArtworks).toHaveLength(13); // 12 + 1 new (artwork-13)
	});

	it('reseed replaces the pool contents and cursor state', () => {
		const pool = createBoundedPoolAccumulator({
			initialArtworks: Array.from({ length: 12 }, (_, i) => makeArtwork(i + 1)),
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn(),
			capacity: 36,
			pageSize: 12
		});

		pool.reseed([makeArtwork(40), makeArtwork(41)], { hasMore: false, nextCursor: null });

		expect(pool.allArtworks.map((artwork) => artwork.id)).toEqual(['artwork-40', 'artwork-41']);
		expect(pool.hasMore).toBe(false);
		expect(pool.hasPendingEviction).toBe(false);
	});
});
