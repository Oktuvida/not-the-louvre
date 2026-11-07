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
	listArtworkDiscovery: vi.fn()
}));

vi.mock('#lib/server/artwork/read.service.js', () => ({
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

describe('artwork collection endpoint', () => {
	beforeEach(() => {
		mocked.listArtworkDiscovery.mockReset();
	});

	// Artworks are published only as drawn documents through the studio's form
	// action. An upload endpoint here let anyone publish an arbitrary image the
	// app never drew, so the collection is read-only over the API.
	it('offers no way to publish an uploaded image', async () => {
		const endpoint = await import('./+server');

		expect(Object.keys(endpoint)).not.toContain('POST');
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
		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{
				cursor: 'cursor-0',
				limit: 12,
				sort: 'recent',
				window: null
			},
			{ user: undefined }
		);
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

	it('passes ranked feed sort and window parameters through the discovery endpoint', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'top'
		});

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			request: new Request('http://localhost/api/artworks?sort=top&window=week&limit=5'),
			url: new URL('http://localhost/api/artworks?sort=top&window=week&limit=5')
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{
				cursor: null,
				limit: 5,
				sort: 'top',
				window: 'week'
			},
			{ user: undefined }
		);
	});

	it('returns validation errors for unsupported ranked sort and window inputs', async () => {
		mocked.listArtworkDiscovery.mockRejectedValueOnce(
			new ArtworkFlowError(400, 'Unsupported artwork discovery sort', 'INVALID_SORT')
		);

		const { GET } = await import('./+server');
		const invalidSortResponse = await GET({
			locals: {},
			request: new Request('http://localhost/api/artworks?sort=chaos'),
			url: new URL('http://localhost/api/artworks?sort=chaos')
		} as never);

		expect(invalidSortResponse.status).toBe(400);
		expect(await invalidSortResponse.json()).toMatchObject({ code: 'INVALID_SORT' });

		mocked.listArtworkDiscovery.mockRejectedValueOnce(
			new ArtworkFlowError(400, 'Unsupported artwork discovery window', 'INVALID_WINDOW')
		);

		const invalidWindowResponse = await GET({
			locals: {},
			request: new Request('http://localhost/api/artworks?sort=top&window=month'),
			url: new URL('http://localhost/api/artworks?sort=top&window=month')
		} as never);

		expect(invalidWindowResponse.status).toBe(400);
		expect(await invalidWindowResponse.json()).toMatchObject({ code: 'INVALID_WINDOW' });
	});

	it('passes ranked continuation cursors through the discovery endpoint', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'hot'
		});

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			request: new Request('http://localhost/api/artworks?sort=hot&cursor=ranked-cursor'),
			url: new URL('http://localhost/api/artworks?sort=hot&cursor=ranked-cursor')
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{
				cursor: 'ranked-cursor',
				limit: undefined,
				sort: 'hot',
				window: null
			},
			{ user: undefined }
		);
	});

	it('passes an optional author filter through the discovery endpoint', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: true, nextCursor: 'cursor-2' },
			sort: 'recent'
		});

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			request: new Request(
				'http://localhost/api/artworks?sort=recent&authorId=user-1&cursor=cursor-1'
			),
			url: new URL('http://localhost/api/artworks?sort=recent&authorId=user-1&cursor=cursor-1')
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{
				authorId: 'user-1',
				cursor: 'cursor-1',
				limit: undefined,
				sort: 'recent',
				window: null
			},
			{ user: undefined }
		);
	});

	it('shares an anonymous discovery page with the edge and serves the stored copy back', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'recent'
		});

		const stored = new Map<string, Response>();
		const waitUntil = vi.fn(async (promise: Promise<unknown>) => promise);
		const platform = {
			caches: {
				default: {
					match: async (url: string) => stored.get(url),
					put: async (url: string, response: Response) => {
						stored.set(url, response);
					}
				}
			},
			context: { waitUntil }
		};
		const request = () => new Request('http://localhost/api/artworks?sort=recent');

		const { GET } = await import('./+server');
		const miss = await GET({
			locals: {},
			platform: usePlatform(platform),
			request: request(),
			url: new URL('http://localhost/api/artworks?sort=recent')
		} as never);

		expect(miss.headers.get('cache-control')).toBe(
			'public, max-age=0, s-maxage=30, stale-while-revalidate=120'
		);
		await Promise.all(waitUntil.mock.calls.map(([promise]) => promise));

		const hit = await GET({
			locals: {},
			platform: usePlatform(platform),
			request: request(),
			url: new URL('http://localhost/api/artworks?sort=recent')
		} as never);

		expect(hit.status).toBe(200);
		expect(mocked.listArtworkDiscovery).toHaveBeenCalledOnce();
	});

	it('never shares a signed-in discovery page with the edge', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'recent'
		});

		const put = vi.fn();
		const match = vi.fn();
		const { GET } = await import('./+server');
		const response = await GET({
			locals: { user: { id: 'user-1', role: 'user' } },
			platform: usePlatform({
				caches: { default: { match, put } },
				context: { waitUntil: vi.fn() }
			}),
			request: new Request('http://localhost/api/artworks?sort=recent'),
			url: new URL('http://localhost/api/artworks?sort=recent')
		} as never);

		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(match).not.toHaveBeenCalled();
		expect(put).not.toHaveBeenCalled();
	});
});
