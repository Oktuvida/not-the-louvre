import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
import type {
	GalleryArtworkPage,
	GalleryPageInfo
} from '#lib/features/gallery-exploration/model/discovery.js';
import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';
import type { GalleryWallId } from '#lib/features/gallery-exploration/model/rooms.js';

/*
 * Per-room feed memory.
 *
 * A room lives inside the keyed room stage of the gallery layout, so
 * switching tabs destroys it along with everything infinite scroll had paged
 * in. Scrolling two hundred artworks deep into the Hot Wall, glancing at the
 * Hall of Fame and coming back used to restart at the first twenty-four, at the
 * top. SvelteKit's `snapshot` export cannot fix that — it only restores on
 * back/forward, and a room tab is a push navigation.
 *
 * This cache lives at module scope, outside every keyed block and every
 * `{#await}`, for the lifetime of the SPA session. A full reload starts empty,
 * which is what we want: a reload is the user asking for fresh data.
 *
 * Coming back, the room goes straight up as it was left, from here, while the
 * server's fresh first page streams; the fresh page then merges into it.
 */

export type RoomFeedSnapshot = {
	artworks: Artwork[];
	/** The grid's measured rows, so the saved scroll lands on the same card. */
	layout?: GridLayoutSnapshot | null;
	pageInfo: GalleryPageInfo;
	scrollY: number;
	/**
	 * The server's first page as the room last drew it. The room's own feed
	 * leaves out what it hands elsewhere (the Hall of Fame's podium), and the
	 * page reads the rest of its state from the seed, so the room is put back
	 * up from both.
	 */
	seed: GalleryArtworkPage;
};

/** Ten pages of 24. Beyond that, restoring costs more than refetching. */
const MAX_CACHED_ARTWORKS = 240;

const snapshots = new Map<GalleryWallId, RoomFeedSnapshot>();

/*
 * A refresh re-streams the room, which unmounts and remounts it — and an
 * unmount is what hands the feed to the cache. Without this the room would
 * quietly restore the feed the visitor just asked to replace, and Refresh would
 * look like it did nothing.
 */
const suppressed = new Set<GalleryWallId>();

export const suppressNextRoomFeedSnapshot = (roomId: GalleryWallId): void => {
	suppressed.add(roomId);
	snapshots.delete(roomId);
};

export const readRoomFeedSnapshot = (roomId: GalleryWallId): RoomFeedSnapshot | null =>
	snapshots.get(roomId) ?? null;

export const writeRoomFeedSnapshot = (roomId: GalleryWallId, snapshot: RoomFeedSnapshot): void => {
	if (suppressed.delete(roomId)) {
		snapshots.delete(roomId);
		return;
	}

	// Nothing paged in yet — a bare first page is cheaper to refetch than to
	// keep, and caching it would freeze a stale order on the next visit.
	if (snapshot.artworks.length === 0) {
		snapshots.delete(roomId);
		return;
	}

	// Past the cap, forget the room instead of half-remembering it. Truncating
	// the tail would leave the restored feed holding pages whose cursor we no
	// longer have: `{ hasMore: true, nextCursor: null }` is unusable state —
	// `loadMore()` bails on the missing cursor while the sentinel keeps firing
	// and suppresses its own end-of-feed line, so the visitor dead-ends with no
	// spinner, no "you've seen it all" and no way forward. Refetching the first
	// page is what the cap already says it prefers.
	if (snapshot.artworks.length > MAX_CACHED_ARTWORKS) {
		snapshots.delete(roomId);
		return;
	}

	// Every room the visitor walks through is kept: there are four, and the cap
	// above bounds each of them.
	snapshots.set(roomId, {
		artworks: [...snapshot.artworks],
		layout: snapshot.layout ?? null,
		pageInfo: { ...snapshot.pageInfo },
		scrollY: Math.max(0, snapshot.scrollY),
		seed: { artworks: [...snapshot.seed.artworks], pageInfo: { ...snapshot.seed.pageInfo } }
	});
};

/*
 * A room left behind keeps the artworks as they were when the visitor walked
 * out, and goes back up with them. The server's fresh first page patches what
 * it holds once it lands, but the pages below it are never refetched, so a
 * vote cast or a comment left in another room since would show up stale there.
 * Every change goes into the cached copies too.
 */
export const patchCachedArtwork = (artworkId: string, patch: Partial<Artwork>): void => {
	for (const listener of patchListeners) listener(artworkId, patch);

	for (const [roomId, snapshot] of snapshots) {
		const holds = (artworks: Artwork[]) => artworks.some((artwork) => artwork.id === artworkId);
		if (!holds(snapshot.artworks) && !holds(snapshot.seed.artworks)) continue;

		const patched = (artworks: Artwork[]) =>
			artworks.map((artwork) => (artwork.id === artworkId ? { ...artwork, ...patch } : artwork));

		snapshots.set(roomId, {
			...snapshot,
			artworks: patched(snapshot.artworks),
			seed: { ...snapshot.seed, artworks: patched(snapshot.seed.artworks) }
		});
	}
};

type ArtworkPatchListener = (artworkId: string, patch: Partial<Artwork>) => void;

// The room on screen keeps its own copies of the pages it fetched below the
// first, which the page never holds, so it hears each change as it happens.
const patchListeners = new Set<ArtworkPatchListener>();

/** Hears every change to an artwork until the returned function is called. */
export const followArtworkPatches = (listener: ArtworkPatchListener): (() => void) => {
	patchListeners.add(listener);
	return () => {
		patchListeners.delete(listener);
	};
};

export const clearRoomFeedCache = (): void => {
	snapshots.clear();
	suppressed.clear();
};

/*
 * The virtualizer only gives the document its full height once it has measured
 * the container and mounted the first rows, so a scroll restore issued on mount
 * lands short. Retry across a bounded number of frames until the document is
 * tall enough to hold the offset, then jump — never smooth-scroll, the user did
 * not ask to watch it.
 */
const MAX_RESTORE_FRAMES = 40;

export const restoreRoomFeedScroll = (targetY: number): (() => void) => {
	if (typeof window === 'undefined' || targetY <= 0) return () => {};

	let frame = 0;
	let handle = 0;

	const step = () => {
		const reachable = document.documentElement.scrollHeight - window.innerHeight;

		if (reachable >= targetY) {
			window.scrollTo({ behavior: 'instant', left: 0, top: targetY });
			return;
		}

		if (++frame >= MAX_RESTORE_FRAMES) {
			// The feed never grew back to its old height (a shorter page, a
			// narrower viewport): land as close as we can rather than at 0.
			window.scrollTo({ behavior: 'instant', left: 0, top: Math.max(0, reachable) });
			return;
		}

		handle = requestAnimationFrame(step);
	};

	handle = requestAnimationFrame(step);

	return () => cancelAnimationFrame(handle);
};
