import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	listArtworkDiscovery: vi.fn(),
	publishArtwork: vi.fn(),
	getIp: vi.fn(() => '127.0.0.1')
}));

vi.mock('$lib/server/artwork/service', () => ({
	publishArtwork: mocked.publishArtwork
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		options: {}
	}
}));

vi.mock('better-auth/api', () => ({
	getIp: mocked.getIp
}));

describe('artwork publish endpoint', () => {
	beforeEach(() => {
		mocked.listArtworkDiscovery.mockReset();
		mocked.publishArtwork.mockReset();
		mocked.getIp.mockClear();
		mocked.publishArtwork.mockImplementation(async (_input, context) => {
			if (!context?.user) {
				throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
			}

			return {
				id: 'artwork-1',
				authorId: context.user.id,
				forkCount: 0,
				title: 'Published artwork',
				parentId: null,
				storageKey: `artworks/${context.user.id}/artwork-1.avif`,
				mediaContentType: 'image/avif',
				mediaSizeBytes: 128,
				createdAt: new Date('2026-03-26T12:00:00.000Z'),
				updatedAt: new Date('2026-03-26T12:00:00.000Z')
			};
		});
	});

	it('rejects unauthenticated publish requests', async () => {
		const { POST } = await import('./+server');
		const formData = new FormData();
		formData.set('title', 'No session');
		formData.set(
			'media',
			new File([new Uint8Array([1, 2, 3])], 'artwork.avif', { type: 'image/avif' })
		);

		const response = await POST({
			locals: {},
			request: new Request('http://localhost/api/artworks', {
				body: formData,
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({
			code: 'UNAUTHENTICATED'
		});
	});

	it('returns discovery results for the recent feed contract', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [
				{
					author: { avatarUrl: null, id: 'user-1', nickname: 'artist_1' },
					commentCount: 2,
					createdAt: new Date('2026-03-26T12:00:00.000Z'),
					forkCount: 3,
					id: 'artwork-1',
					lineage: { isFork: false, parent: null, parentStatus: 'none' },
					mediaUrl: '/api/artworks/artwork-1/media',
					score: 4,
					title: 'Recent artwork'
				}
			],
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			sort: 'recent'
		});

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			request: new Request('http://localhost/api/artworks?sort=recent&limit=12&cursor=cursor-0'),
			url: new URL('http://localhost/api/artworks?sort=recent&limit=12&cursor=cursor-0')
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith({
			cursor: 'cursor-0',
			limit: 12,
			sort: 'recent'
		});
		expect(await response.json()).toMatchObject({
			items: [
				{
					id: 'artwork-1',
					mediaUrl: '/api/artworks/artwork-1/media',
					score: 4,
					commentCount: 2,
					forkCount: 3
				}
			],
			pageInfo: {
				hasMore: true,
				nextCursor: 'cursor-1'
			},
			sort: 'recent'
		});
	});

	it('passes an optional fork parent reference through the publish endpoint', async () => {
		const { POST } = await import('./+server');
		const formData = new FormData();
		formData.set('title', 'Forked artwork');
		formData.set('parentArtworkId', 'artwork-parent');
		formData.set(
			'media',
			new File([new Uint8Array([1, 2, 3])], 'artwork.avif', { type: 'image/avif' })
		);

		const response = await POST({
			locals: {
				user: {
					id: 'user-1'
				}
			},
			request: new Request('http://localhost/api/artworks', {
				body: formData,
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(201);
		expect(mocked.publishArtwork).toHaveBeenCalledTimes(1);
		expect(mocked.publishArtwork.mock.calls[0]?.[0]).toMatchObject({
			parentArtworkId: 'artwork-parent'
		});
	});
});
