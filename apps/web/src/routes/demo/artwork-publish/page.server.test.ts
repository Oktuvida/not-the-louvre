import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actions } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

type PublishActionEvent = Parameters<Actions['publish']>[0];

const mocked = vi.hoisted(() => ({
	getArtworkDetail: vi.fn(),
	getIp: vi.fn(() => '127.0.0.1'),
	listArtworkDiscovery: vi.fn(),
	publishArtwork: vi.fn()
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	getArtworkDetail: mocked.getArtworkDetail,
	listArtworkDiscovery: mocked.listArtworkDiscovery
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
	email: 'journey_artist@not-the-louvre.local',
	id: 'user-1',
	nickname: 'journey_artist',
	role: 'user' as const
};

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
		request: new Request('http://localhost/demo/artwork-publish', {
			body: formData,
			method: 'POST'
		}),
		route: { id: '/demo/artwork-publish' },
		setHeaders: vi.fn(),
		tracing: {} as PublishActionEvent['tracing'],
		url: new URL('http://localhost/demo/artwork-publish')
	} as unknown as PublishActionEvent;
};

describe('artwork publish demo page', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.getArtworkDetail.mockReset();
		mocked.getIp.mockClear();
		mocked.listArtworkDiscovery.mockReset();
		mocked.publishArtwork.mockReset();
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'recent'
		});
		mocked.publishArtwork.mockResolvedValue({ id: 'artwork-1' });
	});

	it('redirects anonymous requests to the nickname auth login page', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ locals: {}, url: new URL('http://localhost/demo/artwork-publish') } as never)
		).rejects.toMatchObject({
			location: '/demo/better-auth/login',
			status: 302
		});
	});

	it('returns the recent feed and the published artwork detail for authenticated viewers', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [
				{
					author: { avatarUrl: null, id: 'user-1', nickname: 'journey_artist' },
					commentCount: 0,
					createdAt: new Date('2026-03-28T10:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-1',
					lineage: { isFork: false, parent: null, parentStatus: 'none' },
					mediaUrl: '/api/artworks/artwork-1/media',
					score: 0,
					title: 'Deterministic Gallery Study'
				}
			],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'recent'
		});
		mocked.getArtworkDetail.mockResolvedValue({
			author: { avatarUrl: null, id: 'user-1', nickname: 'journey_artist' },
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
			title: 'Deterministic Gallery Study',
			updatedAt: new Date('2026-03-28T10:00:00.000Z')
		});

		const { load } = await import('./+page.server');
		const result = await load({
			locals: { user: authenticatedUser },
			url: new URL('http://localhost/demo/artwork-publish?published=artwork-1')
		} as never);

		expect(result).toMatchObject({
			publishedArtwork: {
				id: 'artwork-1',
				title: 'Deterministic Gallery Study'
			},
			user: {
				nickname: 'journey_artist'
			}
		});
		expect(mocked.getArtworkDetail).toHaveBeenCalledWith('artwork-1', {
			user: authenticatedUser
		});
	});

	it('rejects publish attempts that omit artwork media', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.publish(createActionEvent({ title: 'No media yet' }));

		expect(result).toMatchObject({
			status: 400,
			data: {
				code: 'INVALID_MEDIA_FORMAT',
				message: 'Artwork media is required'
			}
		});
		expect(mocked.publishArtwork).not.toHaveBeenCalled();
	});

	it('redirects back to the demo with the published artwork identifier after success', async () => {
		const { actions } = await import('./+page.server');

		await expect(
			actions.publish(
				createActionEvent({
					media: new File([new Uint8Array([1, 2, 3])], 'artwork.avif', { type: 'image/avif' }),
					title: 'Deterministic Gallery Study'
				})
			)
		).rejects.toMatchObject({
			location: '/demo/artwork-publish?published=artwork-1',
			status: 303
		});

		expect(mocked.publishArtwork).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Deterministic Gallery Study'
			}),
			expect.objectContaining({
				ipAddress: '127.0.0.1',
				user: authenticatedUser
			})
		);
	});

	it('returns domain publish failures without dropping the error code', async () => {
		mocked.publishArtwork.mockRejectedValue(
			new ArtworkFlowError(
				400,
				'Artwork media must be AVIF, WebP, JPEG, or PNG',
				'INVALID_MEDIA_FORMAT'
			)
		);

		const { actions } = await import('./+page.server');
		const result = await actions.publish(
			createActionEvent({
				media: new File([new Uint8Array([1, 2, 3])], 'artwork.webp', { type: 'image/webp' }),
				title: 'Bad upload'
			})
		);

		expect(result).toMatchObject({
			status: 400,
			data: {
				code: 'INVALID_MEDIA_FORMAT',
				message: 'Artwork media must be AVIF, WebP, JPEG, or PNG'
			}
		});
	});
});
