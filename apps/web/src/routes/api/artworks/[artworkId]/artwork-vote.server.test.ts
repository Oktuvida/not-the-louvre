import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	applyArtworkVote: vi.fn(),
	getIp: vi.fn(() => '127.0.0.1'),
	removeArtworkVote: vi.fn()
}));

vi.mock('$lib/server/artwork/service', () => ({
	applyArtworkVote: mocked.applyArtworkVote,
	removeArtworkVote: mocked.removeArtworkVote
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		options: {}
	}
}));

vi.mock('better-auth/api', () => ({
	getIp: mocked.getIp
}));

describe('artwork vote endpoint', () => {
	beforeEach(() => {
		mocked.applyArtworkVote.mockReset();
		mocked.removeArtworkVote.mockReset();
		mocked.getIp.mockClear();
	});

	it('applies authenticated vote transitions', async () => {
		mocked.applyArtworkVote.mockResolvedValue({
			artwork: { commentCount: 0, id: 'artwork-1', score: 1 },
			vote: { artworkId: 'artwork-1', id: 'vote-1', userId: 'user-1', value: 'up' }
		});

		const { POST } = await import('./vote/+server');
		const response = await POST({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/vote', {
				body: JSON.stringify({ value: 'up' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.applyArtworkVote).toHaveBeenCalledWith(
			{ artworkId: 'artwork-1', value: 'up' },
			{ ipAddress: '127.0.0.1', user: { id: 'user-1' } }
		);
		expect(await response.json()).toMatchObject({
			artwork: { id: 'artwork-1', score: 1 },
			vote: { id: 'vote-1', value: 'up' }
		});
	});

	it('rejects unauthenticated vote requests', async () => {
		mocked.applyArtworkVote.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const { POST } = await import('./vote/+server');
		const response = await POST({
			locals: {},
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/vote', {
				body: JSON.stringify({ value: 'up' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
	});

	it('removes an authenticated user vote', async () => {
		mocked.removeArtworkVote.mockResolvedValue({
			artwork: { commentCount: 0, id: 'artwork-1', score: 0 },
			removed: null
		});

		const { DELETE } = await import('./vote/+server');
		const response = await DELETE({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/vote', { method: 'DELETE' })
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ artwork: { id: 'artwork-1', score: 0 } });
	});
});
