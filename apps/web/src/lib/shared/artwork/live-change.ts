/*
 * What the realtime Worker passes to everyone with an artwork open. A change
 * carries its data when the server has it at hand (the vote totals, the new
 * comment); one without data (a comment deleted, hidden or reported) asks the
 * viewer to read the artwork again.
 */

export type ArtworkVoteTotals = {
	downvotes: number;
	score: number;
	upvotes: number;
};

/** A comment as the detail panel shows it. */
export type ArtworkLiveComment = {
	author: string;
	id: string;
	text: string;
	timestamp: number;
};

export type ArtworkLiveChangeBody =
	| { change: 'votes'; votes?: ArtworkVoteTotals }
	| { change: 'comments'; comment?: ArtworkLiveComment };

export type ArtworkLiveChange = ArtworkLiveChangeBody & { artworkId: string };
