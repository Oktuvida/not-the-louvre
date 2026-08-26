import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	getArtworkMedia: vi.fn(),
	getArtworkDetail: vi.fn(),
	streamArtworkStorageObject: vi.fn()
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	getArtworkMedia: mocked.getArtworkMedia,
	getArtworkDetail: mocked.getArtworkDetail
}));

vi.mock('$lib/server/artwork/storage', () => ({
	streamArtworkStorageObject: mocked.streamArtworkStorageObject
}));

describe('artwork detail endpoints', () => {
	beforeEach(() => {
		mocked.getArtworkMedia.mockReset();
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
			downvotes: 1,
			score: 7,
			title: 'Detail artwork',
			updatedAt: new Date('2026-03-26T12:00:00.000Z'),
			upvotes: 8,
			viewerVote: 'up'
		});

		const { GET } = await import('./+server');
		const response = await GET({ locals: {}, params: { artworkId: 'artwork-1' } } as never);

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
				downvotes: 1,
				score: 7,
				commentCount: 3,
				upvotes: 8,
				viewerVote: 'up'
			}
		});
	}, 10_000);

	it('returns not found for unknown artwork detail requests', async () => {
		mocked.getArtworkDetail.mockRejectedValue(
			new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND')
		);

		const { GET } = await import('./+server');
		const response = await GET({ locals: {}, params: { artworkId: 'missing-artwork' } } as never);

		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
	});

	it('proxies media through an application-controlled endpoint', async () => {
		mocked.getArtworkMedia.mockResolvedValue({
			id: 'artwork-1',
			mediaContentType: 'image/avif',
			storageKey: 'artworks/user-1/artwork-1.avif'
		});
		mocked.streamArtworkStorageObject.mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]), {
				headers: { 'content-length': '3', 'content-type': 'application/octet-stream' },
				status: 200
			})
		);

		const { GET } = await import('./media/+server');
		const response = await GET({
			locals: {},
			params: { artworkId: 'artwork-1' },
			request: new Request('https://gallery.test/api/artworks/artwork-1/media')
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=31536000, immutable, s-maxage=3600'
		);
		expect(response.headers.get('content-type')).toBe('image/avif');
		expect(response.headers.get('content-length')).toBe('3');
		expect(response.headers.get('etag')).toBe('"artworks/user-1/artwork-1.avif"');
		expect(mocked.streamArtworkStorageObject).toHaveBeenCalledWith(
			'artworks/user-1/artwork-1.avif'
		);
	});

	it('answers matching if-none-match revalidations without touching storage', async () => {
		mocked.getArtworkMedia.mockResolvedValue({
			id: 'artwork-1',
			mediaContentType: 'image/avif',
			storageKey: 'artworks/user-1/artwork-1.avif'
		});

		const { GET } = await import('./media/+server');
		const response = await GET({
			locals: {},
			params: { artworkId: 'artwork-1' },
			request: new Request('https://gallery.test/api/artworks/artwork-1/media', {
				headers: { 'if-none-match': '"artworks/user-1/artwork-1.avif"' }
			})
		} as never);

		expect(response.status).toBe(304);
		expect(response.headers.get('etag')).toBe('"artworks/user-1/artwork-1.avif"');
		expect(mocked.streamArtworkStorageObject).not.toHaveBeenCalled();
	});

	it('serves media from the edge cache without touching the database', async () => {
		const cachedResponse = new Response(new Uint8Array([9]), {
			headers: { etag: '"artworks/user-1/artwork-1.avif"' },
			status: 200
		});
		const edgeCache = {
			match: vi.fn(async () => cachedResponse),
			put: vi.fn(async () => undefined)
		};

		const { GET } = await import('./media/+server');
		const response = await GET({
			locals: {},
			params: { artworkId: 'artwork-1' },
			platform: { caches: { default: edgeCache }, context: { waitUntil: vi.fn() } },
			request: new Request('https://gallery.test/api/artworks/artwork-1/media')
		} as never);

		expect(response).toBe(cachedResponse);
		expect(mocked.getArtworkMedia).not.toHaveBeenCalled();
		expect(mocked.streamArtworkStorageObject).not.toHaveBeenCalled();
	});

	it('stores fresh media responses in the edge cache', async () => {
		mocked.getArtworkMedia.mockResolvedValue({
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
		const edgeCache = {
			match: vi.fn(async () => undefined),
			put: vi.fn(async () => undefined)
		};
		const waitUntil = vi.fn();

		const { GET } = await import('./media/+server');
		const response = await GET({
			locals: {},
			params: { artworkId: 'artwork-1' },
			platform: { caches: { default: edgeCache }, context: { waitUntil } },
			request: new Request('https://gallery.test/api/artworks/artwork-1/media')
		} as never);

		expect(response.status).toBe(200);
		expect(edgeCache.put).toHaveBeenCalledWith(
			'https://gallery.test/api/artworks/artwork-1/media',
			expect.any(Response)
		);
		expect(waitUntil).toHaveBeenCalledTimes(1);
	});
});
