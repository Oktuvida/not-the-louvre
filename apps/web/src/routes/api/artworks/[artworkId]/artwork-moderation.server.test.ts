import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = {
	getIp: vi.fn(() => '127.0.0.1'),
	moderateArtwork: vi.fn()
};

vi.mock('$lib/server/artwork/service', () => ({
	moderateComment: vi.fn(),
	submitContentReport: vi.fn(),
	moderateArtwork: mocked.moderateArtwork
}));

describe('artwork moderation endpoint', () => {
	beforeEach(() => {
		mocked.moderateArtwork.mockReset();
	});

	it('allows moderators to hide artwork through the moderation boundary', async () => {
		mocked.moderateArtwork.mockResolvedValue({
			hiddenAt: new Date('2026-03-26T12:00:00.000Z'),
			id: 'artwork-1',
			isHidden: true
		});

		const { PATCH } = await import('./moderation/+server');
		const response = await PATCH({
			locals: { user: { id: 'moderator-1', role: 'moderator' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/moderation', {
				body: JSON.stringify({ action: 'hide' }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.moderateArtwork).toHaveBeenCalledWith(
			{ action: 'hide', artworkId: 'artwork-1' },
			{ user: { id: 'moderator-1', role: 'moderator' } }
		);
		expect(await response.json()).toMatchObject({ artwork: { id: 'artwork-1', isHidden: true } });
	});

	it('allows moderators to dismiss artwork reports without content mutation', async () => {
		mocked.moderateArtwork.mockResolvedValue({ id: 'artwork-1', isHidden: false });

		const { PATCH } = await import('./moderation/+server');
		const response = await PATCH({
			locals: { user: { id: 'moderator-1', role: 'moderator' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/moderation', {
				body: JSON.stringify({ action: 'dismiss' }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.moderateArtwork).toHaveBeenCalledWith(
			{ action: 'dismiss', artworkId: 'artwork-1' },
			{ user: { id: 'moderator-1', role: 'moderator' } }
		);
	});

	it('allows moderators to mark artwork as NSFW through the moderation boundary', async () => {
		mocked.moderateArtwork.mockResolvedValue({
			id: 'artwork-1',
			isHidden: true,
			isNsfw: true,
			nsfwSource: 'moderator'
		});

		const { PATCH } = await import('./moderation/+server');
		const response = await PATCH({
			locals: { user: { id: 'moderator-1', role: 'moderator' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/moderation', {
				body: JSON.stringify({ action: 'mark_nsfw' }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.moderateArtwork).toHaveBeenCalledWith(
			{ action: 'mark_nsfw', artworkId: 'artwork-1' },
			{ user: { id: 'moderator-1', role: 'moderator' } }
		);
	});

	it('allows moderators to delete artwork through the moderation boundary', async () => {
		mocked.moderateArtwork.mockResolvedValue({ id: 'artwork-1' });

		const { DELETE } = await import('./moderation/+server');
		const response = await DELETE({
			locals: { user: { id: 'moderator-1', role: 'moderator' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/moderation', {
				method: 'DELETE'
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.moderateArtwork).toHaveBeenCalledWith(
			{ action: 'delete', artworkId: 'artwork-1' },
			{ user: { id: 'moderator-1', role: 'moderator' } }
		);
		expect(await response.json()).toMatchObject({ artwork: { id: 'artwork-1' } });
	});

	it('rejects non-moderator artwork moderation requests', async () => {
		mocked.moderateArtwork.mockRejectedValue(
			new ArtworkFlowError(403, 'Moderator access required', 'FORBIDDEN')
		);

		const { PATCH } = await import('./moderation/+server');
		const response = await PATCH({
			locals: { user: { id: 'user-1', role: 'user' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/moderation', {
				body: JSON.stringify({ action: 'unhide' }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			})
		} as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
	});
});
