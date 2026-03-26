import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	findArtworkMediaById: vi.fn(),
	getArtworkDetail: vi.fn(),
	streamArtworkStorageObject: vi.fn()
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	getArtworkDetail: mocked.getArtworkDetail
}));

vi.mock('$lib/server/artwork/read.repository', () => ({
	artworkReadRepository: {
		findArtworkMediaById: mocked.findArtworkMediaById
	}
}));

vi.mock('$lib/server/artwork/storage', () => ({
	streamArtworkStorageObject: mocked.streamArtworkStorageObject
}));

describe('artwork detail endpoints', () => {
	beforeEach(() => {
		mocked.findArtworkMediaById.mockReset();
		mocked.getArtworkDetail.mockReset();
		mocked.streamArtworkStorageObject.mockReset();
	});

	it('returns the detail projection for an existing artwork', async () => {
		mocked.getArtworkDetail.mockResolvedValue({
			author: { avatarUrl: null, id: 'user-1', nickname: 'artist_1' },
			childForks: [
				{
					author: { avatarUrl: null, id: 'user-2', nickname: 'artist_2' },
					createdAt: new Date('2026-03-26T13:00:00.000Z'),
					id: 'artwork-2',
					mediaUrl: '/api/artworks/artwork-2/media',
					title: 'Child fork'
				}
			],
			commentCount: 3,
			createdAt: new Date('2026-03-26T12:00:00.000Z'),
			forkCount: 1,
			id: 'artwork-1',
			lineage: {
				isFork: true,
				parent: {
					author: { avatarUrl: null, id: 'user-9', nickname: 'artist_9' },
					id: 'artwork-parent',
					title: 'Parent artwork'
				},
				parentStatus: 'available'
			},
			mediaContentType: 'image/avif',
			mediaSizeBytes: 128,
			mediaUrl: '/api/artworks/artwork-1/media',
			score: 7,
			title: 'Detail artwork',
			updatedAt: new Date('2026-03-26T12:00:00.000Z')
		});

		const { GET } = await import('./+server');
		const response = await GET({ params: { artworkId: 'artwork-1' } } as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			artwork: {
				childForks: [{ id: 'artwork-2' }],
				forkCount: 1,
				id: 'artwork-1',
				lineage: {
					parent: { id: 'artwork-parent' },
					parentStatus: 'available'
				},
				mediaUrl: '/api/artworks/artwork-1/media',
				score: 7,
				commentCount: 3
			}
		});
	});

	it('returns not found for unknown artwork detail requests', async () => {
		mocked.getArtworkDetail.mockRejectedValue(
			new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND')
		);

		const { GET } = await import('./+server');
		const response = await GET({ params: { artworkId: 'missing-artwork' } } as never);

		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
	});

	it('proxies media through an application-controlled endpoint', async () => {
		mocked.findArtworkMediaById.mockResolvedValue({
			id: 'artwork-1',
			mediaContentType: 'image/avif',
			storageKey: 'artworks/user-1/artwork-1.avif'
		});
		mocked.streamArtworkStorageObject.mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]), {
				headers: { 'content-type': 'application/octet-stream' },
				status: 200
			})
		);

		const { GET } = await import('./media/+server');
		const response = await GET({ params: { artworkId: 'artwork-1' } } as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
		expect(response.headers.get('content-type')).toBe('image/avif');
		expect(mocked.streamArtworkStorageObject).toHaveBeenCalledWith(
			'artworks/user-1/artwork-1.avif'
		);
	});
});
