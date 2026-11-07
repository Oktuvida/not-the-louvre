import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

const mocked = vi.hoisted(() => ({
	getArtworkTimelapse: vi.fn(),
	streamArtworkStorageObject: vi.fn()
}));

vi.mock('#lib/server/artwork/timelapse.service.js', () => ({
	getArtworkTimelapse: mocked.getArtworkTimelapse
}));

vi.mock('#lib/server/artwork/storage.js', () => ({
	streamArtworkStorageObject: mocked.streamArtworkStorageObject
}));

const drawing = { version: 3 };

const event = (path: string) =>
	({
		locals: { user: null },
		params: { artworkId: 'artwork-1' },
		request: new Request(`https://gallery.test${path}`),
		url: new URL(`https://gallery.test${path}`)
	}) as never;

describe('the timelapse endpoints', () => {
	beforeEach(() => {
		mocked.getArtworkTimelapse.mockReset();
		mocked.streamArtworkStorageObject.mockReset();
	});

	it('sends the drawing, and where a fork replays over, to the player', async () => {
		mocked.getArtworkTimelapse.mockResolvedValue({
			backdropKey: 'artworks/author-1/artwork-1.parent.webp',
			drawing,
			isHidden: false
		});

		const { GET } = await import('./+server');
		const response = await GET(event('/api/artworks/artwork-1/timelapse'));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			backdropUrl: '/api/artworks/artwork-1/timelapse/backdrop',
			drawing
		});
		expect(response.headers.get('cache-control')).toMatch(/^public/);
	});

	it('names no backdrop for a drawing made on blank paper', async () => {
		mocked.getArtworkTimelapse.mockResolvedValue({ backdropKey: null, drawing, isHidden: false });

		const { GET } = await import('./+server');
		const body = await (await GET(event('/api/artworks/artwork-1/timelapse'))).json();

		expect(body.backdropUrl).toBeNull();
	});

	it('keeps a hidden artwork out of every shared cache', async () => {
		mocked.getArtworkTimelapse.mockResolvedValue({ backdropKey: null, drawing, isHidden: true });

		const { GET } = await import('./+server');
		const response = await GET(event('/api/artworks/artwork-1/timelapse'));

		expect(response.headers.get('cache-control')).toBe('private, no-store');
	});

	it('answers a missing or hidden artwork as not found', async () => {
		mocked.getArtworkTimelapse.mockRejectedValue(
			new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND')
		);

		const { GET } = await import('./+server');
		const response = await GET(event('/api/artworks/artwork-1/timelapse'));

		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
	});

	it('serves the copy of the image a fork was drawn over', async () => {
		mocked.getArtworkTimelapse.mockResolvedValue({
			backdropKey: 'artworks/author-1/artwork-1.parent.webp',
			drawing,
			isHidden: false
		});
		mocked.streamArtworkStorageObject.mockResolvedValue(
			new Response('webp bytes', { headers: { 'content-type': 'image/webp' } })
		);

		const { GET } = await import('./backdrop/+server');
		const response = await GET(event('/api/artworks/artwork-1/timelapse/backdrop'));

		expect(mocked.streamArtworkStorageObject).toHaveBeenCalledWith(
			'artworks/author-1/artwork-1.parent.webp'
		);
		expect(response.headers.get('content-type')).toBe('image/webp');
		expect(await response.text()).toBe('webp bytes');
	});

	it('has no backdrop for a drawing made on blank paper', async () => {
		mocked.getArtworkTimelapse.mockResolvedValue({ backdropKey: null, drawing, isHidden: false });

		const { GET } = await import('./backdrop/+server');
		const response = await GET(event('/api/artworks/artwork-1/timelapse/backdrop'));

		expect(response.status).toBe(404);
		expect(mocked.streamArtworkStorageObject).not.toHaveBeenCalled();
	});
});
