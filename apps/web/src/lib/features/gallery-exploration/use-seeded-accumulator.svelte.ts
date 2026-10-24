import { untrack } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
import {
	createArtworkAccumulator,
	type ArtworkAccumulator
} from '#lib/features/gallery-exploration/artwork-accumulator.svelte.js';
import type {
	GalleryPageInfo,
	LoadMoreArtworks
} from '#lib/features/gallery-exploration/model/discovery.js';

import {
	readRoomFeedSnapshot,
	restoreRoomFeedScroll,
	writeRoomFeedSnapshot
} from '#lib/features/gallery-exploration/model/feed-cache.js';
import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';
import {
	roomIdForPath,
	type GalleryRoomId
} from '#lib/features/gallery-exploration/model/rooms.js';

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
	/** Reads the room grid's measured rows (VirtualizedGrid's `snapshotLayout`). */
	getLayout?: () => GridLayoutSnapshot | null;
};

export type SeededAccumulator = ArtworkAccumulator & {
	/** The grid layout the room had when it was left, for its grid to remount with. */
	readonly restoredLayout: GridLayoutSnapshot | null;
};

const EMPTY_PAGE_INFO: GalleryPageInfo = { hasMore: false, nextCursor: null };

const seedIdentity = (items: Artwork[]) => items.map((artwork) => artwork.id).join(',');

const pageInfoIdentity = (info: GalleryPageInfo) => `${info.hasMore}:${info.nextCursor ?? ''}`;

export function createSeededAccumulator(options: SeededAccumulatorOptions): SeededAccumulator {
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

	/*
	 * The reconciliation baseline.
	 *
	 * A room mounted from the props alone can take it at construction. A
	 * restored room cannot: the gallery page starts its `artworks` state empty
	 * and fills it from an effect, while the room itself is built synchronously
	 * inside the resolved `{#await}` branch — so at construction the seed is
	 * still `[]`, and one flush later the real seed would look like a fresh
	 * navigation and reseed the restored pages away. A restored room therefore
	 * establishes its baseline on the first reactive run and merges the seed
	 * into the feed it kept.
	 */
	let pendingRestoreMerge = restored !== null;
	let lastSeedIdentity = seedIdentity(initialArtworks);
	let lastPageInfoIdentity = pageInfoIdentity(initialPageInfo);

	$effect(() => {
		const artworks = options.getArtworks();
		const pageInfo = watchPageInfo ? options.getPageInfo() : untrack(() => options.getPageInfo());

		const identity = seedIdentity(artworks);
		const nextPageInfoIdentity = watchPageInfo ? pageInfoIdentity(pageInfo) : lastPageInfoIdentity;

		if (pendingRestoreMerge) {
			// An empty seed here is the page's state before its own effect has
			// filled it, not a room that emptied out: adopting it as the baseline
			// would hand the reseed branch the real seed a flush later.
			if (artworks.length === 0) return;

			pendingRestoreMerge = false;
			lastSeedIdentity = identity;
			lastPageInfoIdentity = nextPageInfoIdentity;
			untrack(() => {
				// Keep the restored pages and the cursor they were fetched with.
				accumulator.mergeSeedArtworks(transformSeed(artworks));
			});
			return;
		}

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
		/*
		 * `beforeNavigate` fires while this room still owns the scroll position.
		 * The teardown below cannot read it: the room sits inside the gallery
		 * layout's `{#key roomId}` block, so its destroy runs behind the block's
		 * out-transition (~225ms) — long after SvelteKit has scrolled the window
		 * back to the top, two ticks after the DOM update of a push navigation.
		 * Reading `window.scrollY` there always stored 0, and a stored 0 makes
		 * the restore a no-op.
		 */
		let lastScrollY = typeof window === 'undefined' ? 0 : window.scrollY;
		// Read with the scroll: by teardown the grid has already gone.
		let lastLayout: GridLayoutSnapshot | null = null;

		const handOverFeed = () =>
			writeRoomFeedSnapshot(feedCacheKey, {
				artworks: $state.snapshot(accumulator.allArtworks),
				layout: lastLayout,
				pageInfo: $state.snapshot(accumulator.pageInfo),
				scrollY: lastScrollY
			});

		beforeNavigate(({ from, shallow, type }) => {
			if (shallow && type === 'goto') return;
			// A copy of this room that is still sliding out hears the next
			// navigation too, from whatever room replaced it; its scroll is not
			// this room's, and writing it would clobber the snapshot.
			if (from && roomIdForPath(from.url.pathname) !== feedCacheKey) return;

			lastScrollY = typeof window === 'undefined' ? 0 : window.scrollY;
			lastLayout = options.getLayout?.() ?? null;
			// Handed over now as well as at teardown: that same out-transition
			// delay means a quick Back mounts the next copy of this room before
			// this one is destroyed, and it would find nothing to restore.
			handOverFeed();
		});

		// Teardown covers the leaves that are not navigations (a refresh).
		$effect(() => () => handOverFeed());

		if (restored && options.restoreScroll !== false) {
			$effect(() => restoreRoomFeedScroll(restored.scrollY));
		}
	}

	return Object.assign(accumulator, { restoredLayout: restored?.layout ?? null });
}
