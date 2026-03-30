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
	artistAvatar?: string;
	imageUrl: string;
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
	viewerVote?: 'down' | 'up' | null;
}
