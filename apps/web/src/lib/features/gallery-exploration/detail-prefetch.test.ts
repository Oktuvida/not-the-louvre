import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeArtwork } from '$lib/features/gallery-exploration/fixtures/artworks';
import { createDetailPrefetcher } from './detail-prefetch';

const loaderFor = (ids: string[] = []) =>
	vi.fn(async (artworkId: string) => {
		ids.push(artworkId);
		return makeArtwork({ id: artworkId });
	});

describe('createDetailPrefetcher', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('warms an artwork once while the entry is still fresh', () => {
		const loadArtworkDetail = loaderFor();
		const prefetcher = createDetailPrefetcher(loadArtworkDetail, { ttlMs: 50 });

		prefetcher.prefetch('artwork-1');
		prefetcher.prefetch('artwork-1');
		prefetcher.prefetch('artwork-1');

		// A repeated press, or a pointer re-entering the same card, must not turn
		// into a burst of per-viewer (so edge-uncacheable) round trips.
		expect(loadArtworkDetail).toHaveBeenCalledTimes(1);
	});

	it('opens from the warm entry instead of fetching again', async () => {
		const loadArtworkDetail = loaderFor();
		const prefetcher = createDetailPrefetcher(loadArtworkDetail, { ttlMs: 50 });

		prefetcher.prefetch('artwork-1');
		await expect(prefetcher.load('artwork-1')).resolves.toMatchObject({ id: 'artwork-1' });

		expect(loadArtworkDetail).toHaveBeenCalledTimes(1);
	});

	it('refetches once the warm entry has gone stale', async () => {
		vi.useFakeTimers();
		const loadArtworkDetail = loaderFor();
		const prefetcher = createDetailPrefetcher(loadArtworkDetail, { ttlMs: 50 });

		prefetcher.prefetch('artwork-1');
		vi.advanceTimersByTime(51);

		// Votes and comments go stale fast; a warm entry is worth exactly one open.
		await expect(prefetcher.load('artwork-1')).resolves.toMatchObject({ id: 'artwork-1' });
		expect(loadArtworkDetail).toHaveBeenCalledTimes(2);
	});

	it('holds no more than one TTL window of warm details', () => {
		vi.useFakeTimers();
		const prefetcher = createDetailPrefetcher(loaderFor(), { ttlMs: 50 });

		prefetcher.prefetch('artwork-1');
		prefetcher.prefetch('artwork-2');
		expect(prefetcher.warmedCount).toBe(2);

		vi.advanceTimersByTime(51);
		prefetcher.prefetch('artwork-3');

		// Warm entries nobody opens are only dropped by this sweep, so without it
		// a scrolling session would retain every detail it ever warmed.
		expect(prefetcher.warmedCount).toBe(1);
	});

	it('leaves no poisoned entry behind when a warm-up fails', async () => {
		const loadArtworkDetail = vi
			.fn<(artworkId: string) => Promise<ReturnType<typeof makeArtwork>>>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(makeArtwork({ id: 'artwork-1' }));
		const prefetcher = createDetailPrefetcher(loadArtworkDetail, { ttlMs: 50 });

		prefetcher.prefetch('artwork-1');
		await vi.waitFor(() => {
			expect(prefetcher.warmedCount).toBe(0);
		});

		await expect(prefetcher.load('artwork-1')).resolves.toMatchObject({ id: 'artwork-1' });
		expect(loadArtworkDetail).toHaveBeenCalledTimes(2);
	});

	it('warms nothing when the visitor asked the browser to save data', async () => {
		vi.stubGlobal('navigator', { connection: { saveData: true } });
		const loadArtworkDetail = loaderFor();
		const prefetcher = createDetailPrefetcher(loadArtworkDetail, { ttlMs: 50 });

		prefetcher.prefetch('artwork-1');
		expect(loadArtworkDetail).not.toHaveBeenCalled();

		// Opening still works — it just pays for its own request.
		await expect(prefetcher.load('artwork-1')).resolves.toMatchObject({ id: 'artwork-1' });
		expect(loadArtworkDetail).toHaveBeenCalledTimes(1);
	});
});
