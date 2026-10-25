import { describe, expect, it } from 'vitest';
import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
import { applyArtworkLiveChange, readArtworkLiveChange } from './artwork-live-change';

const openArtwork: Artwork = {
	artist: 'ash_palette',
	authorId: 'author-1',
	commentCount: 1,
	comments: [{ author: 'coral_brush', id: 'comment-1', text: 'First!', timestamp: 1 }],
	downvotes: 1,
	id: 'artwork-1',
	imageUrl: '/api/artworks/artwork-1/media?v=webp',
	isNsfw: false,
	score: 2,
	timestamp: 0,
	title: 'Paper Moon',
	upvotes: 3,
	viewerVote: 'up'
};

describe('a live change to the open artwork', () => {
	it('takes the new vote totals and keeps what the viewer voted', () => {
		const next = applyArtworkLiveChange(openArtwork, {
			artworkId: 'artwork-1',
			change: 'votes',
			votes: { downvotes: 1, score: 3, upvotes: 4 }
		});

		expect(next).toMatchObject({ downvotes: 1, score: 3, upvotes: 4, viewerVote: 'up' });
	});

	it('adds a new comment to the thread and counts it', () => {
		const comment = { author: 'dusk_canvas', id: 'comment-2', text: 'Lovely', timestamp: 2 };

		const next = applyArtworkLiveChange(openArtwork, {
			artworkId: 'artwork-1',
			change: 'comments',
			comment
		});

		expect(next?.comments).toEqual([...openArtwork.comments, comment]);
		expect(next?.commentCount).toBe(2);
	});

	it('does not add a comment the thread already shows', () => {
		const next = applyArtworkLiveChange(openArtwork, {
			artworkId: 'artwork-1',
			change: 'comments',
			comment: openArtwork.comments[0]!
		});

		expect(next).toBe(openArtwork);
	});

	it('asks for the artwork again when the change came without its data', () => {
		expect(
			applyArtworkLiveChange(openArtwork, { artworkId: 'artwork-1', change: 'comments' })
		).toBe(null);
	});
});

describe('a message from the artwork topic', () => {
	it('reads a vote change with its totals', () => {
		expect(
			readArtworkLiveChange(
				JSON.stringify({
					artworkId: 'artwork-1',
					change: 'votes',
					votes: { downvotes: 0, score: 1, upvotes: 1 }
				})
			)
		).toEqual({
			artworkId: 'artwork-1',
			change: 'votes',
			votes: { downvotes: 0, score: 1, upvotes: 1 }
		});
	});

	it('reads a change whose data does not add up as a bare change', () => {
		expect(
			readArtworkLiveChange(
				JSON.stringify({ artworkId: 'artwork-1', change: 'votes', votes: { score: 'many' } })
			)
		).toEqual({ artworkId: 'artwork-1', change: 'votes' });
	});

	it('ignores anything that is not a change', () => {
		expect(readArtworkLiveChange('pong')).toBe(null);
		expect(readArtworkLiveChange(JSON.stringify({ change: 'votes' }))).toBe(null);
		expect(readArtworkLiveChange(new ArrayBuffer(2))).toBe(null);
	});
});
