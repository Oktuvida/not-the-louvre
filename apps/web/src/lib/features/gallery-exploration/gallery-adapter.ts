import type { ArtworkDetail, ArtworkFeedCard } from '$lib/server/artwork/types';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

type SerializableArtworkFeedCard = Omit<ArtworkFeedCard, 'createdAt'> & {
	createdAt: Date | string;
};
type SerializableArtworkDetail = Omit<ArtworkDetail, 'createdAt' | 'updatedAt'> & {
	createdAt: Date | string;
	updatedAt: Date | string;
};

const toTimestamp = (value: Date | string) =>
	(value instanceof Date ? value : new Date(value)).getTime();

const baseArtwork = (
	artwork: SerializableArtworkFeedCard | SerializableArtworkDetail
): Artwork => ({
	artist: artwork.author.nickname,
	artistAvatar: artwork.author.avatarUrl ?? undefined,
	authorId: artwork.author.id,
	comments: [],
	commentCount: artwork.commentCount,
	downvotes: artwork.downvotes ?? 0,
	forkCount: artwork.forkCount,
	id: artwork.id,
	imageUrl: artwork.mediaUrl,
	imagePlaceholder: artwork.mediaPlaceholder ?? null,
	isNsfw: artwork.isNsfw,
	lineage: artwork.lineage,
	score: artwork.score,
	timestamp: toTimestamp(artwork.createdAt),
	title: artwork.title,
	upvotes: artwork.upvotes ?? 0,
	viewerVote: artwork.viewerVote ?? null
});

/**
 * `rank` is a room position, not a property of the artwork: it is only assigned
 * for the Hall of Fame podium (routes/gallery/gallery-data.server.ts) and only
 * ranks 1-3 ever render a medal, so every other feed call may omit it.
 */
export const toGalleryArtwork = (artwork: SerializableArtworkFeedCard, rank?: number): Artwork => ({
	...baseArtwork(artwork),
	rank
});

/**
 * The detail endpoint has no business returning a room position, so the caller
 * hands the rank of the room copy back in — otherwise the podium medal appears
 * on open and vanishes the moment the fetched detail replaces it.
 */
export const toGalleryArtworkDetail = (
	artwork: SerializableArtworkDetail,
	rank?: number
): Artwork => ({
	...baseArtwork(artwork),
	rank
});

/**
 * The single NSFW predicate. `authorId` and `revealedIds` are optional so the
 * home preview cards, which have neither, can ask the same question as the
 * gallery rooms, the detail panel and the Mystery reel.
 */
export const isArtworkBlurred = (
	artwork: { authorId?: string | null; id: string; isNsfw: boolean },
	viewer: {
		adultContentEnabled: boolean;
		id?: string | null;
		revealedIds?: ReadonlySet<string>;
	}
): boolean => {
	if (!artwork.isNsfw || viewer.adultContentEnabled) return false;
	// Authors always see their own work, and a reveal is honoured everywhere.
	if (artwork.authorId != null && viewer.id === artwork.authorId) return false;

	return !viewer.revealedIds?.has(artwork.id);
};
