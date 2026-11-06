import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
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

vi.mock('#lib/server/platform.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/platform.js')>()),
	edgeCache: () => edge.cache,
	runAfterResponse: () => {}
}));

const mocked = vi.hoisted(() => ({
	getArtworkDetail: vi.fn(),
	listArtworkCommentsForViewer: vi.fn()
}));

vi.mock('#lib/server/artwork/read.service.js', () => mocked);

const hung = new Date('2026-11-05T12:00:00.000Z');

const detail = (title: string) => ({
	author: { avatarUrl: null, id: 'artist-2', nickname: 'oktuvida' },
	childForks: [],
	commentCount: 1,
	createdAt: hung,
	forkCount: 0,
	hasReplay: true,
	id: 'artwork-1',
	isHidden: false,
	isNsfw: false,
	lineage: { isFork: false, parent: null, parentStatus: 'none' },
	mediaContentType: 'image/webp',
	mediaSizeBytes: 128,
	mediaUrl: '/api/artworks/artwork-1/media?v=webp',
	score: 2,
	title,
	updatedAt: hung,
	wish: null
});

const comment = {
	author: { avatarUrl: null, id: 'artist-1', nickname: 'hithere' },
	body: 'What a tired sun',
	createdAt: hung,
	id: 'comment-1'
};

const openPage = async (user?: Viewer) => {
	const { load } = await import('./+page.server');
	return load({
		locals: { user },
		params: { artworkId: 'artwork-1' },
		url: new URL('https://not-the-louvre.test/artwork/artwork-1')
	} as never);
};

describe('an artwork page opened by many visitors', () => {
	beforeEach(() => {
		vi.resetModules();
		edge.stored.clear();
		mocked.getArtworkDetail.mockReset();
		mocked.listArtworkCommentsForViewer.mockReset();
		mocked.getArtworkDetail.mockResolvedValue(detail('A very tired sun'));
		mocked.listArtworkCommentsForViewer.mockResolvedValue([comment]);
	});

	it('serves the next signed-out visitor without reading the database', async () => {
		const first = await openPage();
		mocked.getArtworkDetail.mockResolvedValue(detail('Retitled a moment later'));

		const next = await openPage();

		expect(mocked.getArtworkDetail).toHaveBeenCalledOnce();
		expect(mocked.listArtworkCommentsForViewer).toHaveBeenCalledOnce();
		expect(next).toEqual(first);
		expect(next?.artwork.timestamp).toBe(hung.getTime());
		expect(next?.artwork.comments[0]?.text).toBe('What a tired sun');
	});

	it('always reads the database for a signed-in viewer, and shares nothing of theirs', async () => {
		const artist: Viewer = { id: 'artist-1', role: 'user' };
		await openPage(artist);
		mocked.getArtworkDetail.mockResolvedValue(detail('With their own vote on it'));

		const again = await openPage(artist);

		expect(again?.artwork.title).toBe('With their own vote on it');
		expect(edge.stored.size).toBe(0);
	});

	it('never shares a page that was not found', async () => {
		mocked.getArtworkDetail.mockRejectedValue(
			new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND')
		);

		await expect(openPage()).rejects.toMatchObject({ status: 404 });

		expect(edge.stored.size).toBe(0);
	});
});
