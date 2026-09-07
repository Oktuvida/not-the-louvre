import { untrack } from 'svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import {
	createArtworkAccumulator,
	type ArtworkAccumulator
} from '$lib/features/gallery-exploration/artwork-accumulator.svelte';
import type {
	GalleryPageInfo,
	LoadMoreArtworks
} from '$lib/features/gallery-exploration/model/discovery';
import {
	readRoomFeedSnapshot,
	restoreRoomFeedScroll,
	writeRoomFeedSnapshot
} from '$lib/features/gallery-exploration/model/feed-cache';
import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';

/*
 * The seed reconciliation every room needs, written once.
 *
 * A room owns the pages infinite scroll fetched; the page owns the seed the
 * server streamed. When the seed changes shape (a refresh, a navigation) the
 * room has to start over; when it merely changes values (an optimistic vote, a
 * realtime update) the room has to patch in place or the grid rebuilds under
 * the reader. All four rooms used to carry their own copy of that rule, and the
 * Mystery room had already drifted out of half of it.
 */

export type SeededAccumulatorOptions = {
	/** The room's seed, read reactively — identity is computed on this, untransformed. */
	getArtworks: () => Artwork[];
	getPageInfo: () => GalleryPageInfo;
	/** Read at call time so a late-arriving pager is picked up. */
	getLoadMoreArtworks: () => LoadMoreArtworks | undefined;
	/**
	 * Applied on the way into the accumulator only (Hall of Fame hands its top
	 * three to the podium). Never applied before the identity string, or a
	 * podium-only reorder would stop reseeding the grid below it.
	 */
	transformSeed?: (artworks: Artwork[]) => Artwork[];
	/**
	 * The Mystery reel keeps its pool across cursor-only changes: reseeding it
	 * mid-cycle would restart the reel.
	 */
	watchPageInfo?: boolean;
	/** The reel treats a missing pager as "nothing more", the grids as a bug. */
	emptyPageWhenUnavailable?: boolean;
	/**
	 * Opt in to the cross-navigation feed memory. Production passes the room id;
	 * harnesses leave it undefined so tests never share state. A getter, so the
	 * room reads its own prop inside a closure rather than at init.
	 */
	getFeedCacheKey?: () => GalleryRoomId | null | undefined;
	/** The reel has no scroll of its own. */
	restoreScroll?: boolean;
};

const EMPTY_PAGE_INFO: GalleryPageInfo = { hasMore: false, nextCursor: null };

const seedIdentity = (items: Artwork[]) => items.map((artwork) => artwork.id).join(',');

const pageInfoIdentity = (info: GalleryPageInfo) => `${info.hasMore}:${info.nextCursor ?? ''}`;

export function createSeededAccumulator(options: SeededAccumulatorOptions): ArtworkAccumulator {
	const transformSeed = options.transformSeed ?? ((artworks: Artwork[]) => artworks);
	const watchPageInfo = options.watchPageInfo ?? true;

	// The props are `$state` proxies owned by the page; snapshotting keeps the
	// accumulator's own arrays free of them.
	const initialArtworks: Artwork[] = $state.snapshot(options.getArtworks());
	const initialPageInfo: GalleryPageInfo = $state.snapshot(options.getPageInfo());

	const feedCacheKey = options.getFeedCacheKey?.() ?? null;
	const restored = feedCacheKey ? readRoomFeedSnapshot(feedCacheKey) : null;

	const accumulator = createArtworkAccumulator({
		fetchPage: async (cursor: string) => {
			const loadMoreArtworks = options.getLoadMoreArtworks();
			if (!loadMoreArtworks) {
				if (options.emptyPageWhenUnavailable) {
					return { artworks: [], pageInfo: EMPTY_PAGE_INFO };
				}
				throw new Error('loadMoreArtworks is not configured');
			}
			return loadMoreArtworks({ cursor });
		},
		initialArtworks: restored ? restored.artworks : transformSeed(initialArtworks),
		initialPageInfo: restored ? restored.pageInfo : initialPageInfo
	});

	// Seeded from the props, not from the restored feed: a restored room must
	// merge the fresh seed into the pages it kept instead of dropping them.
	let lastSeedIdentity = seedIdentity(initialArtworks);
	let lastPageInfoIdentity = pageInfoIdentity(initialPageInfo);

	$effect(() => {
		const artworks = options.getArtworks();
		const pageInfo = watchPageInfo ? options.getPageInfo() : untrack(() => options.getPageInfo());

		const identity = seedIdentity(artworks);
		const nextPageInfoIdentity = watchPageInfo ? pageInfoIdentity(pageInfo) : lastPageInfoIdentity;

		if (identity !== lastSeedIdentity || nextPageInfoIdentity !== lastPageInfoIdentity) {
			lastSeedIdentity = identity;
			lastPageInfoIdentity = nextPageInfoIdentity;
			untrack(() => {
				accumulator.reseed(transformSeed(artworks), pageInfo);
			});
			return;
		}

		untrack(() => {
			accumulator.syncSeedArtworks(transformSeed(artworks));
		});
	});

	if (feedCacheKey) {
		// Teardown-only: hand the feed to the cache as the room leaves.
		$effect(() => () => {
			writeRoomFeedSnapshot(feedCacheKey, {
				artworks: $state.snapshot(accumulator.allArtworks),
				pageInfo: $state.snapshot(accumulator.pageInfo),
				scrollY: typeof window === 'undefined' ? 0 : window.scrollY
			});
		});

		if (restored && options.restoreScroll !== false) {
			$effect(() => restoreRoomFeedScroll(restored.scrollY));
		}
	}

	return accumulator;
}
