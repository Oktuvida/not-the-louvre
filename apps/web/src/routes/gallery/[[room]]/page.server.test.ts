import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	getViewerContentPreferences: vi.fn(),
	listArtworkDiscovery: vi.fn()
}));

vi.mock('#lib/server/artwork/read.service.js', () => ({
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

vi.mock('#lib/server/moderation/service.js', () => ({
	getViewerContentPreferences: mocked.getViewerContentPreferences
}));

const makeDiscoveryPage = (
	items: Array<Record<string, unknown>> = [],
	sort: 'hot' | 'recent' | 'top' = 'hot'
) => ({
	items,
	pageInfo: { hasMore: false, nextCursor: null },
	sort
});

const makeItem = (overrides: Record<string, unknown> = {}) => ({
	author: { avatarUrl: null, id: 'user-1', nickname: 'journey_artist' },
	commentCount: 0,
	createdAt: new Date('2026-03-28T10:00:00.000Z'),
	forkCount: 0,
	id: 'artwork-1',
	lineage: { isFork: false, parent: null, parentStatus: 'none' },
	mediaUrl: '/api/artworks/artwork-1/media',
	score: 42,
	title: 'Deterministic Gallery Study',
	...overrides
});

// `/gallery` and `/gallery/[room]` are one route node: the optional parameter
// is absent on the entry point and present on an addressed room.
describe('gallery route', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.getViewerContentPreferences.mockReset();
		mocked.listArtworkDiscovery.mockReset();
		mocked.getViewerContentPreferences.mockResolvedValue({
			adultContentConsentedAt: null,
			adultContentEnabled: false,
			adultContentRevokedAt: null,
			ambientAudioEnabled: null
		});
		mocked.listArtworkDiscovery.mockResolvedValue(makeDiscoveryPage([makeItem()]));
	});

	describe('without a room parameter', () => {
		it('renders the first page into a first visit instead of streaming it', async () => {
			mocked.listArtworkDiscovery.mockResolvedValue(makeDiscoveryPage([makeItem()], 'hot'));

			const { load } = await import('./+page.server');

			const result = (await load({
				isDataRequest: false,
				locals: {},
				params: { room: 'hot-wall' },
				parent: async () => ({ adultContentEnabled: false }),
				url: new URL('http://localhost/gallery/hot-wall')
			} as never)) as {
				initialRoomContent: { artworks: Array<Record<string, unknown>> } | null;
				lazy: { roomContent: unknown };
			};

			expect(result.lazy.roomContent).toBeNull();
			expect(result.initialRoomContent?.artworks).toHaveLength(1);
		});

		it('loads the hall-of-fame room from top discovery results', async () => {
			mocked.listArtworkDiscovery.mockResolvedValue(makeDiscoveryPage([makeItem()], 'top'));

			const { load } = await import('./+page.server');

			const result = (await load({
				isDataRequest: true,
				locals: {},
				params: {},
				parent: async () => ({ adultContentEnabled: false }),
				url: new URL('http://localhost/gallery')
			} as never)) as {
				lazy: { roomContent: Promise<Record<string, unknown>> };
				roomId: string;
			};

			// The shell resolves without waiting for discovery; the room content
			// streams from the nested promise.
			expect(result).toMatchObject({ roomId: 'hall-of-fame', viewer: null });

			// The root layout renders the only <title>; the route names itself.
			expect(result).toMatchObject({ meta: { title: 'Gallery' } });

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
			mocked.listArtworkDiscovery.mockResolvedValue(makeDiscoveryPage([], 'top'));

			const { load } = await import('./+page.server');
			const result = (await load({
				isDataRequest: true,
				locals: {},
				params: {},
				parent: async () => ({ adultContentEnabled: false }),
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

	describe('with a room parameter', () => {
		it('loads the hot wall room from hot discovery results', async () => {
			const { load } = await import('./+page.server');
			const result = (await load({
				isDataRequest: true,
				locals: {},
				params: { room: 'hot-wall' },
				parent: async () => ({ adultContentEnabled: false })
			} as never)) as {
				lazy: { roomContent: Promise<{ discovery: Record<string, unknown> }> };
				roomId: string;
			};

			expect(result).toMatchObject({ roomId: 'hot-wall' });

			// Four rooms used to share one tab title and one share card; the root
			// layout renders the only <title> from what the route contributes here.
			expect(result).toMatchObject({
				meta: {
					description: 'Fresh pieces rising fast through the current gallery heat.',
					title: 'The Hot Wall'
				}
			});

			const roomContent = await result.lazy.roomContent;

			expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
				{ cursor: null, limit: 24, sort: 'hot', window: null },
				{ user: undefined }
			);
			expect(roomContent.discovery).toMatchObject({
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
				isDataRequest: true,
				locals: {},
				params: { room: 'mystery' },
				parent: async () => ({ adultContentEnabled: false })
			} as never)) as {
				lazy: { roomContent: Promise<{ discovery: Record<string, unknown> }> };
				roomId: string;
			};

			expect(result).toMatchObject({ roomId: 'mystery' });

			const roomContent = await result.lazy.roomContent;

			expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
				{ cursor: null, limit: 24, sort: 'recent', window: null },
				{ user: undefined }
			);
			expect(roomContent.discovery).toMatchObject({
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
						makeItem({ title: 'Mine' }),
						makeItem({
							author: { avatarUrl: null, id: 'user-2', nickname: 'other_artist' },
							createdAt: new Date('2026-03-28T09:00:00.000Z'),
							id: 'artwork-2',
							mediaUrl: '/api/artworks/artwork-2/media',
							score: 11,
							title: 'Not mine'
						})
					],
					'recent'
				)
			);

			const { load } = await import('./+page.server');
			const result = (await load({
				isDataRequest: true,
				locals: { user: { id: 'user-1', role: 'user' } },
				params: { room: 'your-studio' },
				parent: async () => ({ adultContentEnabled: false })
			} as never)) as {
				lazy: {
					roomContent: Promise<{
						artworks: Array<Record<string, unknown>>;
						discovery: Record<string, unknown>;
					}>;
				};
				viewer: { id: string };
			};

			expect(result.viewer).toMatchObject({ id: 'user-1' });

			const roomContent = await result.lazy.roomContent;

			expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
				{ authorId: 'user-1', cursor: null, limit: 24, sort: 'recent', window: null },
				{ user: { id: 'user-1', role: 'user' } }
			);
			expect(roomContent.artworks).toHaveLength(1);
			expect(roomContent.artworks[0]).toMatchObject({ id: 'artwork-1' });
			expect(roomContent.discovery).toMatchObject({
				pageInfo: { hasMore: false, nextCursor: null },
				request: {
					authorId: 'user-1',
					limit: 24,
					sort: 'recent',
					window: null
				}
			});
		});

		it('takes the adult-content preference from the layout instead of re-reading the row', async () => {
			const { load } = await import('./+page.server');
			const result = (await load({
				isDataRequest: true,
				locals: { user: { id: 'user-1', role: 'user' } },
				params: { room: 'hot-wall' },
				parent: async () => ({ adultContentEnabled: true })
			} as never)) as {
				lazy: { roomContent: Promise<{ adultContentEnabled: boolean }> };
			};

			await expect(result.lazy.roomContent).resolves.toMatchObject({ adultContentEnabled: true });
			expect(mocked.getViewerContentPreferences).not.toHaveBeenCalled();
		});

		it('redirects signed-out visitors away from the personal studio room', async () => {
			const { load } = await import('./+page.server');

			await expect(
				load({
					locals: {},
					params: { room: 'your-studio' },
					parent: async () => ({ adultContentEnabled: false })
				} as never)
			).rejects.toMatchObject({
				location: '/gallery',
				status: 302
			});
		});

		it('returns 404 for unknown room ids', async () => {
			const { load } = await import('./+page.server');

			await expect(
				load({
					locals: {},
					params: { room: 'unknown-room' },
					parent: async () => ({ adultContentEnabled: false })
				} as never)
			).rejects.toMatchObject({
				status: 404
			});
		});
	});
});
