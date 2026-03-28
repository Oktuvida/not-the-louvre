import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = {
	getIp: vi.fn(() => '127.0.0.1'),
	moderateComment: vi.fn()
};

vi.mock('$lib/server/artwork/service', () => ({
	moderateArtwork: vi.fn(),
	submitContentReport: vi.fn(),
	moderateComment: mocked.moderateComment
}));

describe('artwork comment moderation endpoint', () => {
	beforeEach(() => {
		mocked.moderateComment.mockReset();
	});

	it('allows moderators to hide comments through the moderation boundary', async () => {
		mocked.moderateComment.mockResolvedValue({
			artworkId: 'artwork-1',
			hiddenAt: new Date('2026-03-26T12:00:00.000Z'),
			id: 'comment-1',
			isHidden: true
		});

		const { PATCH } = await import('./comments/[commentId]/moderation/+server');
		const response = await PATCH({
			locals: { user: { id: 'moderator-1', role: 'moderator' } },
			params: { artworkId: 'artwork-1', commentId: 'comment-1' },
			request: new Request(
				'http://localhost/api/artworks/artwork-1/comments/comment-1/moderation',
				{
					body: JSON.stringify({ action: 'hide' }),
					headers: { 'content-type': 'application/json' },
					method: 'PATCH'
				}
			)
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.moderateComment).toHaveBeenCalledWith(
			{ action: 'hide', artworkId: 'artwork-1', commentId: 'comment-1' },
			{ user: { id: 'moderator-1', role: 'moderator' } }
		);
		expect(await response.json()).toMatchObject({ comment: { id: 'comment-1', isHidden: true } });
	});

	it('allows moderators to dismiss comment reports without content mutation', async () => {
		mocked.moderateComment.mockResolvedValue({
			artworkId: 'artwork-1',
			id: 'comment-1',
			isHidden: false
		});

		const { PATCH } = await import('./comments/[commentId]/moderation/+server');
		const response = await PATCH({
			locals: { user: { id: 'moderator-1', role: 'moderator' } },
			params: { artworkId: 'artwork-1', commentId: 'comment-1' },
			request: new Request(
				'http://localhost/api/artworks/artwork-1/comments/comment-1/moderation',
				{
					body: JSON.stringify({ action: 'dismiss' }),
					headers: { 'content-type': 'application/json' },
					method: 'PATCH'
				}
			)
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.moderateComment).toHaveBeenCalledWith(
			{ action: 'dismiss', artworkId: 'artwork-1', commentId: 'comment-1' },
			{ user: { id: 'moderator-1', role: 'moderator' } }
		);
	});

	it('allows moderators to delete comments through the moderation boundary', async () => {
		mocked.moderateComment.mockResolvedValue({ id: 'comment-1' });

		const { DELETE } = await import('./comments/[commentId]/moderation/+server');
		const response = await DELETE({
			locals: { user: { id: 'moderator-1', role: 'moderator' } },
			params: { artworkId: 'artwork-1', commentId: 'comment-1' },
			request: new Request(
				'http://localhost/api/artworks/artwork-1/comments/comment-1/moderation',
				{
					method: 'DELETE'
				}
			)
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.moderateComment).toHaveBeenCalledWith(
			{ action: 'delete', artworkId: 'artwork-1', commentId: 'comment-1' },
			{ user: { id: 'moderator-1', role: 'moderator' } }
		);
		expect(await response.json()).toMatchObject({ comment: { id: 'comment-1' } });
	});

	it('rejects non-moderator comment moderation requests', async () => {
		mocked.moderateComment.mockRejectedValue(
			new ArtworkFlowError(403, 'Moderator access required', 'FORBIDDEN')
		);

		const { PATCH } = await import('./comments/[commentId]/moderation/+server');
		const response = await PATCH({
			locals: { user: { id: 'user-1', role: 'user' } },
			params: { artworkId: 'artwork-1', commentId: 'comment-1' },
			request: new Request(
				'http://localhost/api/artworks/artwork-1/comments/comment-1/moderation',
				{
					body: JSON.stringify({ action: 'unhide' }),
					headers: { 'content-type': 'application/json' },
					method: 'PATCH'
				}
			)
		} as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
	});
});
