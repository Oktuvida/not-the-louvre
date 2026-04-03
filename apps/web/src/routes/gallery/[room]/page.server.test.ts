import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	listArtworkDiscovery: vi.fn()
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

const makeDiscoveryPage = (
	items: Array<Record<string, unknown>> = [],
	sort: 'hot' | 'recent' = 'hot'
) => ({
	items,
	pageInfo: { hasMore: false, nextCursor: null },
	sort
});

describe('gallery room route', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.listArtworkDiscovery.mockReset();
		mocked.listArtworkDiscovery.mockResolvedValue(
			makeDiscoveryPage([
				{
					author: { avatarUrl: null, id: 'user-1', nickname: 'journey_artist' },
					commentCount: 0,
					createdAt: new Date('2026-03-28T10:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-1',
					lineage: { isFork: false, parent: null, parentStatus: 'none' },
					mediaUrl: '/api/artworks/artwork-1/media',
					score: 42,
					title: 'Deterministic Gallery Study'
				}
			])
		);
	});

	it('loads the hot wall room from hot discovery results', async () => {
		const { load } = await import('./+page.server');
		const result = (await load({
			locals: {},
			params: { room: 'hot-wall' }
		} as never)) as { roomId: string; discovery: Record<string, unknown> };

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{ cursor: null, limit: 24, sort: 'hot', window: null },
			{ user: undefined }
		);
		expect(result).toMatchObject({ roomId: 'hot-wall' });
		expect(result.discovery).toMatchObject({
			pageInfo: { hasMore: false, nextCursor: null },
			request: {
				authorId: null,
				limit: 24,
				sort: 'hot',
				window: null
			}
		});
	});

	it('loads the mystery room with continuation metadata', async () => {
		const { load } = await import('./+page.server');
		const result = (await load({
			locals: {},
			params: { room: 'mystery' }
		} as never)) as { roomId: string; discovery: Record<string, unknown> };

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{ cursor: null, limit: 24, sort: 'recent', window: null },
			{ user: undefined }
		);
		expect(result).toMatchObject({ roomId: 'mystery' });
		expect(result.discovery).toMatchObject({
			pageInfo: { hasMore: false, nextCursor: null },
			request: {
				authorId: null,
				limit: 24,
				sort: 'recent',
				window: null
			}
		});
	});

	it('returns a user-scoped studio room from recent discovery results', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue(
			makeDiscoveryPage(
				[
					{
						author: { avatarUrl: null, id: 'user-1', nickname: 'journey_artist' },
						commentCount: 0,
						createdAt: new Date('2026-03-28T10:00:00.000Z'),
						forkCount: 0,
						id: 'artwork-1',
						lineage: { isFork: false, parent: null, parentStatus: 'none' },
						mediaUrl: '/api/artworks/artwork-1/media',
						score: 42,
						title: 'Mine'
					},
					{
						author: { avatarUrl: null, id: 'user-2', nickname: 'other_artist' },
						commentCount: 0,
						createdAt: new Date('2026-03-28T09:00:00.000Z'),
						forkCount: 0,
						id: 'artwork-2',
						lineage: { isFork: false, parent: null, parentStatus: 'none' },
						mediaUrl: '/api/artworks/artwork-2/media',
						score: 11,
						title: 'Not mine'
					}
				],
				'recent'
			)
		);

		const { load } = await import('./+page.server');
		const result = (await load({
			locals: { user: { id: 'user-1', role: 'user' } },
			params: { room: 'your-studio' }
		} as never)) as {
			artworks: Array<Record<string, unknown>>;
			discovery: {
				pageInfo: { hasMore: boolean; nextCursor: string | null };
				request: { authorId: string; limit: number; sort: string; window: null };
			};
			viewer: { id: string };
		};

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{ authorId: 'user-1', cursor: null, limit: 24, sort: 'recent', window: null },
			{ user: { id: 'user-1', role: 'user' } }
		);
		expect(result.artworks).toHaveLength(1);
		expect(result.artworks[0]).toMatchObject({ id: 'artwork-1' });
		expect(result.discovery).toMatchObject({
			pageInfo: { hasMore: false, nextCursor: null },
			request: {
				authorId: 'user-1',
				limit: 24,
				sort: 'recent',
				window: null
			}
		});
		expect(result.viewer).toMatchObject({ id: 'user-1' });
	});

	it('redirects signed-out visitors away from the personal studio room', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ locals: {}, params: { room: 'your-studio' } } as never)
		).rejects.toMatchObject({
			location: '/gallery',
			status: 302
		});
	});

	it('returns 404 for unknown room ids', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ locals: {}, params: { room: 'unknown-room' } } as never)
		).rejects.toMatchObject({
			status: 404
		});
	});
});
