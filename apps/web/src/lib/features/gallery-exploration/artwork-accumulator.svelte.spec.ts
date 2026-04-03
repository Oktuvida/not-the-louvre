import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import { createArtworkAccumulator } from './artwork-accumulator.svelte';

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

describe('createArtworkAccumulator', () => {
	it('initializes with artworks and pageInfo', () => {
		const initial = Array.from({ length: 5 }, (_, i) => makeArtwork(i + 1));
		const acc = createArtworkAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage: vi.fn()
		});

		expect(acc.allArtworks).toHaveLength(5);
		expect(acc.hasMore).toBe(true);
		expect(acc.isLoading).toBe(false);
		expect(acc.error).toBeNull();
	});

	it('loadMore appends fetched artworks deduplicated by ID and updates cursor', async () => {
		const initial = Array.from({ length: 3 }, (_, i) => makeArtwork(i + 1));
		const nextPage = [makeArtwork(3), makeArtwork(4), makeArtwork(5)]; // artwork-3 is a dupe

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
			initialArtworks: [makeArtwork(1)],
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
			initialArtworks: [makeArtwork(1)],
			initialPageInfo: { hasMore: false, nextCursor: null },
			fetchPage
		});

		await acc.loadMore();

		expect(fetchPage).not.toHaveBeenCalled();
	});

	it('sets error when fetch fails and retry re-attempts the same cursor', async () => {
		const fetchPage = vi
			.fn()
			.mockRejectedValueOnce(new Error('Network error'))
			.mockResolvedValueOnce({
				artworks: [makeArtwork(2)],
				pageInfo: { hasMore: false, nextCursor: null }
			});

		const acc = createArtworkAccumulator({
			initialArtworks: [makeArtwork(1)],
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

	it('chunks artworks into rows based on columnCount', () => {
		const initial = Array.from({ length: 7 }, (_, i) => makeArtwork(i + 1));

		const acc = createArtworkAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: false, nextCursor: null },
			fetchPage: vi.fn(),
			columnCount: 3
		});

		expect(acc.rows).toHaveLength(3); // ceil(7/3)
		expect(acc.rows[0]).toHaveLength(3);
		expect(acc.rows[1]).toHaveLength(3);
		expect(acc.rows[2]).toHaveLength(1);
	});

	it('recomputes rows when columnCount changes', () => {
		const initial = Array.from({ length: 6 }, (_, i) => makeArtwork(i + 1));
		let colCount = $state(3);

		const acc = createArtworkAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: false, nextCursor: null },
			fetchPage: vi.fn(),
			get columnCount() {
				return colCount;
			}
		});

		expect(acc.rows).toHaveLength(2); // 6/3

		flushSync(() => {
			colCount = 2;
		});

		expect(acc.rows).toHaveLength(3); // 6/2
	});

	it('reset clears appended artworks and restores to initial state', async () => {
		const initial = Array.from({ length: 3 }, (_, i) => makeArtwork(i + 1));
		const fetchPage = vi.fn().mockResolvedValueOnce({
			artworks: [makeArtwork(4), makeArtwork(5)],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const acc = createArtworkAccumulator({
			initialArtworks: initial,
			initialPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			fetchPage
		});

		await acc.loadMore();
		expect(acc.allArtworks).toHaveLength(5);

		acc.reset();

		expect(acc.allArtworks).toHaveLength(3);
		expect(acc.hasMore).toBe(true);
	});
});
