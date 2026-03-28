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
	comments: [],
	commentCount: artwork.commentCount,
	downvotes: 0,
	forkCount: artwork.forkCount,
	id: artwork.id,
	imageUrl: artwork.mediaUrl,
	score: artwork.score,
	timestamp: toTimestamp(artwork.createdAt),
	title: artwork.title,
	upvotes: 0,
	viewerVote: null
});

export const toGalleryArtwork = (artwork: SerializableArtworkFeedCard, rank?: number): Artwork => ({
	...baseArtwork(artwork),
	rank
});

export const toGalleryArtworkDetail = (artwork: SerializableArtworkDetail): Artwork => ({
	...baseArtwork(artwork)
});
