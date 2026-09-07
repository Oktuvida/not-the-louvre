// Mirrors the `app.artwork_vote_value` enum; the vote endpoint, the read
// projections and the detail panel all speak this one vocabulary.
export const ARTWORK_VOTE_VALUES = ['up', 'down'] as const;

export type ArtworkVoteValue = (typeof ARTWORK_VOTE_VALUES)[number];

export const isArtworkVoteValue = (value: string): value is ArtworkVoteValue =>
	(ARTWORK_VOTE_VALUES as readonly string[]).includes(value);
