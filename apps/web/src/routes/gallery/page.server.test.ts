import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	listArtworkDiscovery: vi.fn()
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

const makeDiscoveryPage = (items: Array<Record<string, unknown>> = []) => ({
	items,
	pageInfo: { hasMore: false, nextCursor: null },
	sort: 'top'
});

describe('gallery root route', () => {
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

	it('loads the hall-of-fame room from top discovery results', async () => {
		const { load } = await import('./+page.server');

		const result = (await load({
			locals: {},
			url: new URL('http://localhost/gallery')
		} as never)) as {
			artworks: Array<Record<string, unknown>>;
			emptyStateMessage: string | null;
			roomId: string;
		};

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{ cursor: null, limit: 12, sort: 'top', window: 'all' },
			{ user: undefined }
		);
		expect(result).toMatchObject({
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: null
			},
			emptyStateMessage: null,
			roomId: 'hall-of-fame',
			viewer: null
		});
		expect(result.artworks).toHaveLength(1);
	});

	it('returns an honest empty state when no artworks are discoverable', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue(makeDiscoveryPage());

		const { load } = await import('./+page.server');
		const result = (await load({
			locals: {},
			url: new URL('http://localhost/gallery')
		} as never)) as {
			artworks: Array<Record<string, unknown>>;
			emptyStateMessage: string | null;
			roomId: string;
		};

		expect(result).toMatchObject({
			emptyStateMessage: 'No artworks have reached this gallery room yet.',
			roomId: 'hall-of-fame',
			viewer: null
		});
		expect(result.artworks).toEqual([]);
	});
});
