import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import type { GalleryPageInfo } from '$lib/features/gallery-exploration/model/discovery';
import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';

/*
 * Per-room feed memory.
 *
 * A room lives inside the `{#key roomId}` block of the gallery layout, so
 * switching tabs destroys it along with everything infinite scroll had paged
 * in. Scrolling two hundred artworks deep into the Hot Wall, glancing at the
 * Hall of Fame and coming back used to restart at the first twenty-four, at the
 * top. SvelteKit's `snapshot` export cannot fix that — it only restores on
 * back/forward, and a room tab is a push navigation.
 *
 * This cache lives at module scope, outside every keyed block and every
 * `{#await}`, for the lifetime of the SPA session. A full reload starts empty,
 * which is what we want: a reload is the user asking for fresh data.
 */

export type RoomFeedSnapshot = {
	artworks: Artwork[];
	pageInfo: GalleryPageInfo;
	scrollY: number;
};

/** Only the two most recently visited rooms are worth holding on to. */
const MAX_CACHED_ROOMS = 2;

/** Ten pages of 24. Beyond that, restoring costs more than refetching. */
const MAX_CACHED_ARTWORKS = 240;

const snapshots = new Map<GalleryRoomId, RoomFeedSnapshot>();

/*
 * A refresh re-streams the room, which unmounts and remounts it — and an
 * unmount is what hands the feed to the cache. Without this the room would
 * quietly restore the feed the visitor just asked to replace, and Refresh would
 * look like it did nothing.
 */
const suppressed = new Set<GalleryRoomId>();

export const suppressNextRoomFeedSnapshot = (roomId: GalleryRoomId): void => {
	suppressed.add(roomId);
	snapshots.delete(roomId);
};

export const readRoomFeedSnapshot = (roomId: GalleryRoomId): RoomFeedSnapshot | null =>
	snapshots.get(roomId) ?? null;

export const writeRoomFeedSnapshot = (roomId: GalleryRoomId, snapshot: RoomFeedSnapshot): void => {
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

	// Re-inserting moves the room to the end of the Map's insertion order, so
	// the first key is always the least recently left room.
	snapshots.delete(roomId);
	snapshots.set(roomId, {
		artworks: [...snapshot.artworks],
		pageInfo: { ...snapshot.pageInfo },
		scrollY: Math.max(0, snapshot.scrollY)
	});

	while (snapshots.size > MAX_CACHED_ROOMS) {
		const oldest = snapshots.keys().next();
		if (oldest.done) break;
		snapshots.delete(oldest.value);
	}
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
