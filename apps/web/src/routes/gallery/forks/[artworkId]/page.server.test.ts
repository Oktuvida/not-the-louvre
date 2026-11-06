import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

const mocked = vi.hoisted(() => ({
	getArtworkDetail: vi.fn(),
	listArtworkDiscovery: vi.fn()
}));

vi.mock('#lib/server/artwork/read.service.js', () => ({
	getArtworkDetail: mocked.getArtworkDetail,
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

const card = (id: string, title: string) => ({
	author: { avatarUrl: null, id: 'artist-1', nickname: 'coral_brush' },
	commentCount: 0,
	createdAt: new Date('2026-10-03T10:00:00.000Z'),
	forkCount: 0,
	id,
	lineage: { isFork: false, parent: null, parentStatus: 'none' },
	mediaUrl: `/api/artworks/${id}/media`,
	score: 4,
	title
});

const visit = async (artworkId: string) => {
	const { load } = await import('./+page.server');
	return load({ locals: {}, params: { artworkId } } as never);
};

describe('the forks of an artwork', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.getArtworkDetail.mockReset();
		mocked.listArtworkDiscovery.mockReset();
		mocked.getArtworkDetail.mockResolvedValue({
			...card('original', 'The Original'),
			childForks: [],
			updatedAt: new Date('2026-10-03T10:00:00.000Z')
		});
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [card('fork-a', 'Fork A'), card('fork-b', 'Fork B')],
			pageInfo: { hasMore: true, nextCursor: 'next' },
			sort: 'recent'
		});
	});

	it('hangs the forks under the piece they came from, newest first', async () => {
		const result = (await visit('original')) as Record<string, unknown>;

		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{
				authorId: null,
				cursor: null,
				limit: 24,
				parentId: 'original',
				sort: 'recent',
				window: null
			},
			{ user: undefined }
		);
		expect(result).toMatchObject({
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'next' },
				request: { parentId: 'original' }
			},
			forksOf: { id: 'original', title: 'The Original' },
			meta: { title: 'Forks of The Original' },
			roomId: null
		});
		expect((result.artworks as { id: string }[]).map((artwork) => artwork.id)).toEqual([
			'fork-a',
			'fork-b'
		]);
	});

	it('says so when nobody has forked the piece', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'recent'
		});

		await expect(visit('original')).resolves.toMatchObject({
			emptyStateMessage: 'Nobody has forked this piece yet.'
		});
	});

	it('is a missing page for a piece that is not there', async () => {
		mocked.getArtworkDetail.mockRejectedValue(new ArtworkFlowError(404, 'Gone', 'NOT_FOUND'));

		await expect(visit('nothing')).rejects.toMatchObject({ status: 404 });
	});
});
