import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

const mocked = vi.hoisted(() => ({
	getArtistStudio: vi.fn(),
	listArtworkDiscovery: vi.fn()
}));

vi.mock('#lib/server/artwork/read.service.js', () => ({
	getArtistStudio: mocked.getArtistStudio,
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

const ARTIST = {
	avatarUrl: null,
	id: 'artist-1',
	nickname: 'coral_brush',
	stats: { hangingSince: new Date('2026-10-02T10:00:00.000Z'), pieces: 2, stars: 9 }
};

const item = (id: string) => ({
	author: { avatarUrl: null, id: 'artist-1', nickname: 'coral_brush' },
	commentCount: 0,
	createdAt: new Date('2026-10-03T10:00:00.000Z'),
	forkCount: 0,
	id,
	lineage: { isFork: false, parent: null, parentStatus: 'none' },
	mediaUrl: `/api/artworks/${id}/media`,
	score: 4,
	title: `Piece ${id}`
});

const visit = async (nickname: string, user?: { id: string; nickname: string }) => {
	const { load } = await import('./+page.server');
	return load({
		locals: { user },
		params: { nickname },
		parent: async () => ({ adultContentEnabled: false })
	} as never);
};

describe('an artist’s studio', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.getArtistStudio.mockReset();
		mocked.listArtworkDiscovery.mockReset();
		mocked.getArtistStudio.mockResolvedValue(ARTIST);
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [item('a'), item('b')],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'recent'
		});
	});

	it('hangs the artist’s own work, newest first, and names the page after them', async () => {
		const result = (await visit('coral_brush')) as Record<string, unknown>;

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{ authorId: 'artist-1', cursor: null, limit: 24, sort: 'recent', window: null },
			{ user: undefined }
		);
		expect(result).toMatchObject({
			artist: { id: 'artist-1', nickname: 'coral_brush' },
			meta: { title: 'The studio of coral_brush' },
			roomId: null
		});
		expect((result.artworks as { id: string }[]).map((artwork) => artwork.id)).toEqual(['a', 'b']);
	});

	it('finds an artist however a link spelled their name', async () => {
		await visit('Coral_Brush');

		expect(mocked.getArtistStudio).toHaveBeenCalledWith('coral_brush', { user: undefined });
	});

	it('is a missing page for a name nobody has', async () => {
		mocked.getArtistStudio.mockRejectedValue(
			new ArtworkFlowError(404, 'Artist not found', 'NOT_FOUND')
		);

		await expect(visit('nobody')).rejects.toMatchObject({ status: 404 });
	});

	it('sends an artist who visits their own name to their studio', async () => {
		await expect(visit('coral_brush', { id: 'artist-1', nickname: 'coral_brush' })).rejects.toEqual(
			expect.objectContaining({ location: '/gallery/your-studio', status: 302 })
		);
		expect(mocked.listArtworkDiscovery).not.toHaveBeenCalled();
	});
});
