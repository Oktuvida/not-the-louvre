import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

// Handlers reach the Cloudflare runtime through #lib/server/platform.js; each
// test registers the cache and waitUntil it would have found there.
type FakePlatform = {
	caches?: { default?: unknown };
	context?: { waitUntil?: (promise: Promise<unknown>) => void };
};
const fakePlatform = vi.hoisted(() => ({ current: undefined as FakePlatform | undefined }));
vi.mock('#lib/server/platform.js', () => ({
	edgeCache: () => fakePlatform.current?.caches?.default,
	hyperdriveConnectionString: () => undefined,
	runAfterResponse: (promise: Promise<unknown>) =>
		fakePlatform.current?.context?.waitUntil?.(promise)
}));
const usePlatform = (platform: FakePlatform) => {
	fakePlatform.current = platform;
	return platform;
};
beforeEach(() => {
	fakePlatform.current = undefined;
});

const mocked = vi.hoisted(() => ({
	getArtworkMedia: vi.fn(),
	getArtworkDetail: vi.fn(),
	deleteArtwork: vi.fn(),
	streamArtworkStorageObject: vi.fn(),
	updateArtworkTitle: vi.fn()
}));

vi.mock('#lib/server/artwork/service.js', () => ({
	deleteArtwork: mocked.deleteArtwork,
	updateArtworkTitle: mocked.updateArtworkTitle,
	withoutDrawingDocument: <T>(artwork: T) => ({ ...artwork, drawingDocument: null })
}));

vi.mock('#lib/server/artwork/read.service.js', () => ({
	getArtworkMedia: mocked.getArtworkMedia,
	getArtworkDetail: mocked.getArtworkDetail
}));

vi.mock('#lib/server/artwork/storage.js', () => ({
	streamArtworkStorageObject: mocked.streamArtworkStorageObject
}));

describe('artwork detail endpoints', () => {
	beforeEach(() => {
		mocked.getArtworkMedia.mockReset();
		mocked.getArtworkDetail.mockReset();
		mocked.deleteArtwork.mockReset();
		mocked.streamArtworkStorageObject.mockReset();
		mocked.updateArtworkTitle.mockReset();
	});

	it('drops the shared copy of an artwork its author deleted', async () => {
		mocked.deleteArtwork.mockResolvedValue({ id: 'artwork-1' });
		const edgeCache = { delete: vi.fn(async () => true) };
		const waitUntil = vi.fn();

		const { DELETE } = await import('./+server');
		await DELETE({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1' },
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil } }),
			request: new Request('https://gallery.test/api/artworks/artwork-1', { method: 'DELETE' }),
			url: new URL('https://gallery.test/api/artworks/artwork-1')
		} as never);

		// The GET below shares its anonymous payload at the edge, so a deleted
		// artwork that is still stored there stays readable for the whole TTL.
		expect(edgeCache.delete).toHaveBeenCalledWith('https://gallery.test/api/artworks/artwork-1');
		expect(waitUntil).toHaveBeenCalled();
	});

	it('drops the shared copy of a retitled artwork', async () => {
		mocked.updateArtworkTitle.mockResolvedValue({ id: 'artwork-1', title: 'New title' });
		const edgeCache = { delete: vi.fn(async () => true) };

		const { PATCH } = await import('./+server');
		await PATCH({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1' },
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil: vi.fn() } }),
			request: new Request('https://gallery.test/api/artworks/artwork-1', {
				body: JSON.stringify({ title: 'New title' }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			}),
			url: new URL('https://gallery.test/api/artworks/artwork-1')
		} as never);

		expect(edgeCache.delete).toHaveBeenCalledWith('https://gallery.test/api/artworks/artwork-1');
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

	it('serves the anonymous detail payload from the edge cache without a query', async () => {
		const cachedResponse = new Response(JSON.stringify({ artwork: { id: 'artwork-1' } }), {
			headers: { 'content-type': 'application/json' },
			status: 200
		});
		const edgeCache = {
			match: vi.fn(async () => cachedResponse),
			put: vi.fn(async () => undefined)
		};

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { artworkId: 'artwork-1' },
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil: vi.fn() } }),
			request: new Request('https://gallery.test/api/artworks/artwork-1')
		} as never);

		expect(response).toBe(cachedResponse);
		expect(mocked.getArtworkDetail).not.toHaveBeenCalled();
	});

	it('never reads or writes the edge cache for a signed-in viewer', async () => {
		mocked.getArtworkDetail.mockResolvedValue({ id: 'artwork-1', viewerVote: 'up' });
		const edgeCache = {
			match: vi.fn(async () => undefined),
			put: vi.fn(async () => undefined)
		};

		const { GET } = await import('./+server');
		const response = await GET({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1' },
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil: vi.fn() } }),
			request: new Request('https://gallery.test/api/artworks/artwork-1')
		} as never);

		// A viewer-specific payload must never reach a shared cache entry, and a
		// signed-in viewer must never be served the anonymous one.
		expect(edgeCache.match).not.toHaveBeenCalled();
		expect(edgeCache.put).not.toHaveBeenCalled();
		expect(response.headers.get('cache-control')).toBe('private, no-store');
	});

	it('stores the anonymous detail payload in the edge cache', async () => {
		mocked.getArtworkDetail.mockResolvedValue({ id: 'artwork-1', viewerVote: null });
		const edgeCache = {
			match: vi.fn(async () => undefined),
			put: vi.fn(async () => undefined)
		};
		const waitUntil = vi.fn();

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { artworkId: 'artwork-1' },
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil } }),
			request: new Request('https://gallery.test/api/artworks/artwork-1')
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=0, s-maxage=30, stale-while-revalidate=120'
		);
		expect(edgeCache.put).toHaveBeenCalledWith(
			'https://gallery.test/api/artworks/artwork-1',
			expect.any(Response)
		);
		expect(waitUntil).toHaveBeenCalled();
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
			request: new Request('https://gallery.test/api/artworks/artwork-1/media?v=avif')
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

	// The cutover redraws lossy AVIF artworks as WebP under the same artwork id;
	// a browser that kept the AVIF forever must still get the WebP.
	it('only lets browsers keep an image for good under the format it names', async () => {
		mocked.getArtworkMedia.mockResolvedValue({
			id: 'artwork-1',
			mediaContentType: 'image/webp',
			storageKey: 'artworks/user-1/artwork-1.webp'
		});

		const { GET } = await import('./media/+server');
		for (const url of [
			'https://gallery.test/api/artworks/artwork-1/media',
			'https://gallery.test/api/artworks/artwork-1/media?v=avif'
		]) {
			mocked.streamArtworkStorageObject.mockResolvedValue(
				new Response(new Uint8Array([1, 2, 3]), { status: 200 })
			);
			const response = await GET({
				locals: {},
				params: { artworkId: 'artwork-1' },
				request: new Request(url)
			} as never);

			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=3600');
		}
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
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil: vi.fn() } }),
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
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil } }),
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
