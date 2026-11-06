import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
import type {
	ArtworkLiveChange,
	ArtworkLiveComment,
	ArtworkVoteTotals
} from '#lib/shared/artwork/live-change.js';

/*
 * A change pushed by the artwork's topic, applied to the open artwork. The
 * totals and the new comment come from the server, so nobody has to read the
 * artwork again; a change without them returns null and the page does.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isVoteTotals = (value: unknown): value is ArtworkVoteTotals =>
	isRecord(value) &&
	typeof value.downvotes === 'number' &&
	typeof value.score === 'number' &&
	typeof value.upvotes === 'number';

const isLiveComment = (value: unknown): value is ArtworkLiveComment =>
	isRecord(value) &&
	typeof value.author === 'string' &&
	typeof value.id === 'string' &&
	typeof value.text === 'string' &&
	typeof value.timestamp === 'number';

/** A WebSocket message as a change, or null when it is not one. */
export const readArtworkLiveChange = (data: unknown): ArtworkLiveChange | null => {
	if (typeof data !== 'string') return null;

	let message: unknown;
	try {
		message = JSON.parse(data);
	} catch {
		return null;
	}

	if (!isRecord(message) || typeof message.artworkId !== 'string') return null;
	const { artworkId } = message;

	if (message.change === 'votes') {
		return isVoteTotals(message.votes)
			? { artworkId, change: 'votes', votes: message.votes }
			: { artworkId, change: 'votes' };
	}

	if (message.change === 'comments') {
		return isLiveComment(message.comment)
			? { artworkId, change: 'comments', comment: message.comment }
			: { artworkId, change: 'comments' };
	}

	return null;
};

export const applyArtworkLiveChange = (
	artwork: Artwork,
	change: ArtworkLiveChange
): Artwork | null => {
	if (change.change === 'votes') {
		return change.votes ? { ...artwork, ...change.votes } : null;
	}

	if (!change.comment) return null;

	// The commenter's own panel has usually added it already.
	if (artwork.comments.some((comment) => comment.id === change.comment!.id)) return artwork;

	return {
		...artwork,
		commentCount: (artwork.commentCount ?? artwork.comments.length) + 1,
		comments: [...artwork.comments, change.comment]
	};
};
