import type { ArtworkVoteValue } from '#lib/shared/content/votes.js';

export interface ArtworkComment {
	id: string;
	author: string;
	text: string;
	timestamp: number;
}

export interface ArtworkLineageParent {
	id: string;
	title: string;
	author: {
		avatarUrl: string | null;
		id: string;
		nickname: string;
	};
}

export interface ArtworkLineage {
	isFork: boolean;
	parent: ArtworkLineageParent | null;
	parentStatus: 'available' | 'deleted' | 'none';
}

export interface Artwork {
	id: string;
	title: string;
	artist: string;
	authorId: string;
	artistAvatar?: string;
	imageUrl: string;
	isHidden?: boolean;
	score: number;
	upvotes: number;
	downvotes: number;
	timestamp: number;
	isNsfw: boolean;
	commentCount?: number;
	comments: ArtworkComment[];
	forkCount?: number;
	lineage?: ArtworkLineage;
	rank?: number;
	viewerVote?: ArtworkVoteValue | null;
}

/**
 * What votes, comments and forks change about an artwork. A room's copy takes
 * only these from a fresher one: its `rank` belongs to the room, not to the
 * artwork, and the detail endpoint does not return it.
 */
export const artworkEngagement = (artwork: Artwork) => ({
	commentCount: artwork.commentCount,
	comments: artwork.comments,
	downvotes: artwork.downvotes,
	forkCount: artwork.forkCount,
	score: artwork.score,
	upvotes: artwork.upvotes,
	viewerVote: artwork.viewerVote
});
