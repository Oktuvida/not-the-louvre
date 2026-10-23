import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';

/*
 * Warm the artwork detail on intent, not on hover.
 *
 * Opening a card costs two uncached round trips (`/api/artworks/:id` and its
 * comments) that only start on click, so the postcard opens with the room's
 * copy of the artwork and the votes and comments pop in a round trip later.
 * `pointerdown` — and `keydown` for the keyboard — lands 80-150ms before the
 * click on every input type and wastes essentially nothing, whereas hover
 * prefetching a grid whose cards scale under the pointer would fire dozens of
 * per-viewer (so uncacheable) requests on one sweep.
 */

export type ArtworkDetailLoader = (artworkId: string) => Promise<Artwork>;

export type DetailPrefetcher = {
	/** Fire and forget; deduplicated while in flight and for a short TTL after. */
	prefetch: (artworkId: string) => void;
	/** Consumes a warm entry when there is one, otherwise loads normally. */
	load: ArtworkDetailLoader;
	clear: () => void;
	/** How many warm details are held right now — the memory bound, for tests. */
	readonly warmedCount: number;
};

/** Votes and comments go stale fast; a warm entry is only worth one open. */
const DEFAULT_TTL_MS = 15_000;

const isDataSaverOn = (): boolean => {
	if (typeof navigator === 'undefined') return false;
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	return connection?.saveData === true;
};

export const createDetailPrefetcher = (
	loadArtworkDetail: ArtworkDetailLoader,
	options: { ttlMs?: number } = {}
): DetailPrefetcher => {
	const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
	const warmed = new Map<string, { expiresAt: number; promise: Promise<Artwork> }>();

	const take = (artworkId: string): Promise<Artwork> | null => {
		const entry = warmed.get(artworkId);
		if (!entry) return null;

		warmed.delete(artworkId);
		return entry.expiresAt > Date.now() ? entry.promise : null;
	};

	return {
		prefetch(artworkId: string) {
			if (!artworkId || isDataSaverOn()) return;

			// A warm entry that is never opened is only removed by `take()`, so
			// without this sweep a session's worth of details — each with its
			// comments — would stay reachable long past their TTL. Bound the map
			// to one TTL window instead.
			const now = Date.now();
			for (const [id, entry] of warmed) {
				if (entry.expiresAt <= now) warmed.delete(id);
			}

			const existing = warmed.get(artworkId);
			if (existing && existing.expiresAt > now) return;

			const promise = loadArtworkDetail(artworkId);
			warmed.set(artworkId, { expiresAt: now + ttlMs, promise });
			// Nobody awaits a prefetch that is never opened; mark it handled so a
			// failed warm-up cannot surface as an unhandled rejection.
			void promise.catch(() => {
				warmed.delete(artworkId);
			});
		},
		load(artworkId: string) {
			return take(artworkId) ?? loadArtworkDetail(artworkId);
		},
		clear() {
			warmed.clear();
		},
		get warmedCount() {
			return warmed.size;
		}
	};
};
