import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

const mocked = vi.hoisted(() => ({
	connectToArtworkTopic: vi.fn(),
	getArtworkMedia: vi.fn()
}));

vi.mock('#lib/server/artwork/read.service.js', () => ({
	getArtworkMedia: mocked.getArtworkMedia
}));

vi.mock('#lib/server/realtime/artwork-topics.js', () => ({
	connectToArtworkTopic: mocked.connectToArtworkTopic
}));

const upgradeRequest = () =>
	new Request('http://localhost/api/artworks/artwork-1/live', {
		headers: { upgrade: 'websocket' }
	});

describe('GET /api/artworks/[artworkId]/live', () => {
	beforeEach(() => {
		mocked.connectToArtworkTopic.mockReset();
		mocked.getArtworkMedia.mockReset();
	});

	it('only speaks WebSocket', async () => {
		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/live')
		} as never);

		expect(response.status).toBe(426);
		expect(mocked.connectToArtworkTopic).not.toHaveBeenCalled();
	});

	it('never lets a viewer listen to an artwork they cannot see', async () => {
		mocked.getArtworkMedia.mockRejectedValue(
			new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND')
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { artworkId: 'artwork-1' },
			request: upgradeRequest()
		} as never);

		expect(response.status).toBe(404);
		expect(mocked.connectToArtworkTopic).not.toHaveBeenCalled();
	});
});
