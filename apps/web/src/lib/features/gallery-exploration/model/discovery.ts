import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

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
