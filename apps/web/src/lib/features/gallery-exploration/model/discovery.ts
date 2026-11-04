import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
import type { GalleryWallId } from '#lib/shared/gallery/rooms.js';

/*
 * The paging vocabulary of the gallery feed. The `{ hasMore, nextCursor }`
 * literal used to be re-typed in every room, harness and accumulator; one
 * alias keeps a change to the contract a single edit.
 */

export type GalleryPageInfo = {
	hasMore: boolean;
	nextCursor: string | null;
};

export type GalleryArtworkPage = {
	artworks: Artwork[];
	pageInfo: GalleryPageInfo;
};

/** Room-scoped pager: the room only supplies the cursor, the page binds the rest. */
export type LoadMoreArtworks = (request: { cursor: string }) => Promise<GalleryArtworkPage>;

export type GalleryDiscoveryRequest = {
	authorId: string | null;
	limit: number;
	sort: 'hot' | 'recent' | 'top';
	window: 'all' | null;
};

export type GalleryDiscovery = {
	pageInfo: GalleryPageInfo;
	request: GalleryDiscoveryRequest | null;
};

const GALLERY_PAGE_SIZE = 24;

/**
 * What a room asks the feed for. It depends only on the room and on who is
 * looking, so the server's room loader and the browser read it from here: a
 * room put back up from memory can page on before its fresh first page lands.
 */
export const galleryRoomDiscoveryRequest = (
	roomId: GalleryWallId,
	viewerId: string | null
): GalleryDiscoveryRequest => {
	if (roomId === 'hall-of-fame') {
		return { authorId: null, limit: 12, sort: 'top', window: 'all' };
	}

	if (roomId === 'hot-wall') {
		return { authorId: null, limit: GALLERY_PAGE_SIZE, sort: 'hot', window: null };
	}

	// The Mystery Room shows nothing of the feed: it only needs to know the
	// gallery is not empty, and each spin asks for its own artwork.
	if (roomId === 'mystery') {
		return { authorId: null, limit: 1, sort: 'recent', window: null };
	}

	if (roomId === 'your-studio' && viewerId) {
		return { authorId: viewerId, limit: GALLERY_PAGE_SIZE, sort: 'recent', window: null };
	}

	return { authorId: null, limit: GALLERY_PAGE_SIZE, sort: 'recent', window: null };
};

/** What a visit to an artist's studio asks the feed for. */
export const artistDiscoveryRequest = (artistId: string): GalleryDiscoveryRequest => ({
	authorId: artistId,
	limit: GALLERY_PAGE_SIZE,
	sort: 'recent',
	window: null
});

/** The room payload the server streams into the page. */
export type GalleryRoomContent = {
	adultContentEnabled: boolean;
	artworks: Artwork[];
	discovery: {
		pageInfo: GalleryPageInfo;
		request: GalleryDiscoveryRequest;
	};
	emptyStateMessage: string | null;
};
