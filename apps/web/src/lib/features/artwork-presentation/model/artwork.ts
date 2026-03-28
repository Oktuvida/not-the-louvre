export interface ArtworkComment {
	id: string;
	author: string;
	text: string;
	timestamp: number;
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
	comments: ArtworkComment[];
	rank?: number;
}
