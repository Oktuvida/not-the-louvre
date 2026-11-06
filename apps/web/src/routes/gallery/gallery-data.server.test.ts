import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Viewer } from '#lib/shared/viewer.js';

// The colo's cache, as the Cache API behaves: what is put comes back as a copy.
const edge = vi.hoisted(() => {
	const stored = new Map<string, Response>();
	return {
		cache: {
			match: async (url: string) => stored.get(url)?.clone(),
			put: async (url: string, response: Response) => {
				stored.set(url, response);
			}
		},
		stored
	};
});

vi.mock('#lib/server/platform.js', () => ({
	edgeCache: () => edge.cache,
	runAfterResponse: () => {}
}));

const mocked = vi.hoisted(() => ({ listArtworkDiscovery: vi.fn() }));

vi.mock('#lib/server/artwork/read.service.js', () => ({
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

vi.mock('#lib/server/moderation/service.js', () => ({
	getViewerContentPreferences: vi.fn()
}));

const origin = 'https://not-the-louvre.test';
const artist: Viewer = { id: 'artist-1', role: 'user' };
const hung = new Date('2026-11-05T12:00:00.000Z');

const firstPage = (title: string) => ({
	items: [
		{
			author: { avatarUrl: null, id: 'artist-2', nickname: 'oktuvida' },
			commentCount: 0,
			createdAt: hung,
			forkCount: 0,
			id: 'artwork-1',
			isHidden: false,
			isNsfw: false,
			lineage: { isFork: false, parent: null, parentStatus: 'none' },
			mediaUrl: '/api/artworks/artwork-1/media?v=webp',
			score: 0,
			title
		}
	],
	pageInfo: { hasMore: false, nextCursor: null }
});

const openRoom = async (roomId: 'hot-wall' | 'wet-paint', viewer?: Viewer) => {
	const { loadGalleryRoomContent } = await import('./gallery-data.server');
	return loadGalleryRoomContent(roomId, viewer, { adultContentEnabled: false, origin });
};

describe('a gallery room opened by many visitors', () => {
	beforeEach(() => {
		edge.stored.clear();
		mocked.listArtworkDiscovery.mockReset();
		mocked.listArtworkDiscovery.mockResolvedValue(firstPage('A very tired sun'));
	});

	it('serves the next signed-out visitor without reading the database', async () => {
		const first = await openRoom('wet-paint');
		mocked.listArtworkDiscovery.mockResolvedValue(firstPage('Hung a moment later'));

		const next = await openRoom('wet-paint');

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledOnce();
		expect(next).toEqual(first);
		expect(next.artworks[0]?.timestamp).toBe(hung.getTime());
	});

	it('keeps each room to itself', async () => {
		await openRoom('wet-paint');
		mocked.listArtworkDiscovery.mockResolvedValue(firstPage('The hottest thing'));

		const hotWall = await openRoom('hot-wall');

		expect(hotWall.artworks[0]?.title).toBe('The hottest thing');
	});

	it('always reads the database for a signed-in artist, and shares nothing of theirs', async () => {
		await openRoom('wet-paint', artist);
		mocked.listArtworkDiscovery.mockResolvedValue(firstPage('Their own vote on it'));

		const again = await openRoom('wet-paint', artist);

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledTimes(2);
		expect(again.artworks[0]?.title).toBe('Their own vote on it');
		expect(edge.stored.size).toBe(0);
	});

	it('does not hand a signed-in artist the page shared with visitors', async () => {
		await openRoom('wet-paint');
		mocked.listArtworkDiscovery.mockResolvedValue(firstPage('Fresh from the database'));

		const artistsRoom = await openRoom('wet-paint', artist);

		expect(artistsRoom.artworks[0]?.title).toBe('Fresh from the database');
	});
});
