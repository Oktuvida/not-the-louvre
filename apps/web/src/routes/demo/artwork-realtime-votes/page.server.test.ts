import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actions } from './$types';

const mocked = vi.hoisted(() => ({
	getArtworkDetail: vi.fn(),
	getIp: vi.fn(() => '127.0.0.1'),
	publishArtwork: vi.fn()
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	getArtworkDetail: mocked.getArtworkDetail
}));

vi.mock('$lib/server/artwork/service', () => ({
	publishArtwork: mocked.publishArtwork
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		options: {}
	}
}));

vi.mock('better-auth/api', () => ({
	getIp: mocked.getIp
}));

const authenticatedUser = {
	authUserId: 'auth-user-1',
	email: 'observer@not-the-louvre.local',
	id: 'user-1',
	nickname: 'observer',
	role: 'user' as const
};

type PublishActionEvent = Parameters<Actions['publish']>[0];

const createActionEvent = (fields: Record<string, string | File>, user = authenticatedUser) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}

	return {
		locals: { user },
		cookies: {} as RequestEvent['cookies'],
		fetch,
		getClientAddress: () => '127.0.0.1',
		isDataRequest: false,
		isRemoteRequest: false,
		isSubRequest: false,
		params: {},
		platform: undefined,
		request: new Request('http://localhost/demo/artwork-realtime-votes', {
			body: formData,
			method: 'POST'
		}),
		route: { id: '/demo/artwork-realtime-votes' },
		setHeaders: vi.fn(),
		tracing: {} as PublishActionEvent['tracing'],
		url: new URL('http://localhost/demo/artwork-realtime-votes')
	} as unknown as PublishActionEvent;
};

describe('artwork realtime vote demo page', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.getArtworkDetail.mockReset();
		mocked.getIp.mockClear();
		mocked.publishArtwork.mockReset();
		mocked.publishArtwork.mockResolvedValue({ id: 'artwork-1' });
	});

	it('redirects anonymous requests to the nickname auth login page', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ locals: {}, url: new URL('http://localhost/demo/artwork-realtime-votes') } as never)
		).rejects.toMatchObject({
			location: '/demo/better-auth/login',
			status: 302
		});
	});

	it('returns the tracked artwork detail when an artwork id is present', async () => {
		mocked.getArtworkDetail.mockResolvedValue({
			author: { avatarUrl: null, id: 'user-1', nickname: 'observer' },
			childForks: [],
			commentCount: 0,
			createdAt: new Date('2026-03-28T10:00:00.000Z'),
			forkCount: 0,
			id: 'artwork-1',
			lineage: { isFork: false, parent: null, parentStatus: 'none' },
			mediaContentType: 'image/avif',
			mediaSizeBytes: 128,
			mediaUrl: '/api/artworks/artwork-1/media',
			score: 0,
			title: 'Realtime Gallery Study',
			updatedAt: new Date('2026-03-28T10:00:00.000Z')
		});

		const { load } = await import('./+page.server');
		const result = await load({
			locals: { user: authenticatedUser },
			url: new URL('http://localhost/demo/artwork-realtime-votes?artworkId=artwork-1')
		} as never);

		expect(result).toMatchObject({
			trackedArtwork: {
				id: 'artwork-1',
				score: 0,
				title: 'Realtime Gallery Study'
			},
			user: {
				nickname: 'observer'
			}
		});
		expect(mocked.getArtworkDetail).toHaveBeenCalledWith('artwork-1', {
			user: authenticatedUser
		});
	});

	it('returns an empty tracked artwork state when no artwork id is present', async () => {
		const { load } = await import('./+page.server');
		const result = await load({
			locals: { user: authenticatedUser },
			url: new URL('http://localhost/demo/artwork-realtime-votes')
		} as never);

		expect(result).toMatchObject({ trackedArtwork: null });
		expect(mocked.getArtworkDetail).not.toHaveBeenCalled();
	});

	it('publishes the tracked artwork and redirects to the same route with its id', async () => {
		const { actions } = await import('./+page.server');

		await expect(
			actions.publish(
				createActionEvent({
					media: new File([new Uint8Array([1, 2, 3])], 'artwork.avif', { type: 'image/avif' }),
					title: 'Realtime Gallery Study'
				})
			)
		).rejects.toMatchObject({
			location: '/demo/artwork-realtime-votes?artworkId=artwork-1',
			status: 303
		});

		expect(mocked.publishArtwork).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Realtime Gallery Study' }),
			expect.objectContaining({ ipAddress: '127.0.0.1', user: authenticatedUser })
		);
	});
});
