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
			lazy: { roomContent: Promise<Record<string, unknown>> };
			roomId: string;
		};

		// The shell resolves without waiting for discovery; the room content
		// streams from the nested promise.
		expect(result).toMatchObject({ roomId: 'hall-of-fame', viewer: null });

		const roomContent = (await result.lazy.roomContent) as {
			artworks: Array<Record<string, unknown>>;
		};

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{ cursor: null, limit: 12, sort: 'top', window: 'all' },
			{ user: undefined }
		);
		expect(roomContent).toMatchObject({
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: {
					authorId: null,
					limit: 12,
					sort: 'top',
					window: 'all'
				}
			},
			emptyStateMessage: null
		});
		expect(roomContent.artworks).toHaveLength(1);
	});

	it('returns an honest empty state when no artworks are discoverable', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue(makeDiscoveryPage());

		const { load } = await import('./+page.server');
		const result = (await load({
			locals: {},
			url: new URL('http://localhost/gallery')
		} as never)) as {
			lazy: { roomContent: Promise<Record<string, unknown>> };
			roomId: string;
		};

		expect(result).toMatchObject({ roomId: 'hall-of-fame', viewer: null });

		const roomContent = (await result.lazy.roomContent) as {
			artworks: Array<Record<string, unknown>>;
		};

		expect(roomContent).toMatchObject({
			emptyStateMessage: 'No artworks have reached this gallery room yet.'
		});
		expect(roomContent.artworks).toEqual([]);
	});
});
