import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	createArtworkComment: vi.fn(),
	deleteArtworkComment: vi.fn(),
	getIp: vi.fn(() => '127.0.0.1'),
	listArtworkCommentsForViewer: vi.fn()
}));

vi.mock('$lib/server/artwork/service', () => ({
	createArtworkComment: mocked.createArtworkComment,
	deleteArtworkComment: mocked.deleteArtworkComment
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	listArtworkCommentsForViewer: mocked.listArtworkCommentsForViewer
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		options: {}
	}
}));

vi.mock('better-auth/api', () => ({
	getIp: mocked.getIp
}));

describe('artwork comments endpoints', () => {
	beforeEach(() => {
		mocked.createArtworkComment.mockReset();
		mocked.deleteArtworkComment.mockReset();
		mocked.listArtworkCommentsForViewer.mockReset();
		mocked.getIp.mockClear();
	});

	it('creates comments for authenticated users', async () => {
		mocked.createArtworkComment.mockResolvedValue({
			author: { avatarUrl: null, id: 'user-1', nickname: 'artist_1' },
			artworkId: 'artwork-1',
			body: 'Great work',
			id: 'comment-1'
		});

		const { POST } = await import('./comments/+server');
		const response = await POST({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/comments', {
				body: JSON.stringify({ body: 'Great work' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(201);
		expect(mocked.createArtworkComment).toHaveBeenCalledWith(
			{ artworkId: 'artwork-1', body: 'Great work' },
			{ ipAddress: '127.0.0.1', user: { id: 'user-1' } }
		);
		expect(await response.json()).toMatchObject({ comment: { id: 'comment-1' } });
	});

	it('lists comments in the public artwork boundary', async () => {
		mocked.listArtworkCommentsForViewer.mockResolvedValue([
			{
				author: { avatarUrl: null, id: 'user-1', nickname: 'artist_1' },
				artworkId: 'artwork-1',
				body: 'First',
				createdAt: new Date('2026-03-26T12:00:00.000Z'),
				id: 'comment-1',
				updatedAt: new Date('2026-03-26T12:00:00.000Z')
			}
		]);

		const { GET } = await import('./comments/+server');
		const response = await GET({ locals: {}, params: { artworkId: 'artwork-1' } } as never);

		expect(response.status).toBe(200);
		expect(mocked.listArtworkCommentsForViewer).toHaveBeenCalledWith('artwork-1', {
			user: undefined
		});
		expect(await response.json()).toMatchObject({ comments: [{ id: 'comment-1' }] });
	});

	it('deletes comments only for the author boundary', async () => {
		mocked.deleteArtworkComment.mockResolvedValue({
			artworkId: 'artwork-1',
			body: 'First',
			createdAt: new Date('2026-03-26T12:00:00.000Z'),
			id: 'comment-1',
			updatedAt: new Date('2026-03-26T12:01:00.000Z')
		});

		const { DELETE } = await import('./comments/[commentId]/+server');
		const response = await DELETE({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1', commentId: 'comment-1' }
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ comment: { id: 'comment-1' } });
	});

	it('returns artwork flow errors from comment creation', async () => {
		mocked.createArtworkComment.mockRejectedValue(
			new ArtworkFlowError(400, 'Comment is invalid', 'INVALID_COMMENT')
		);

		const { POST } = await import('./comments/+server');
		const response = await POST({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/comments', {
				body: JSON.stringify({ body: '' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ code: 'INVALID_COMMENT' });
	});
});
