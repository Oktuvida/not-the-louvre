import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actions } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

type DrawPublishActionEvent = Parameters<Actions['publish']>[0];

const mocked = vi.hoisted(() => ({
	getIp: vi.fn(() => '127.0.0.1'),
	getArtworkDetail: vi.fn(),
	publishArtwork: vi.fn()
}));

vi.mock('$lib/server/artwork/service', () => ({
	publishArtwork: mocked.publishArtwork
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	getArtworkDetail: mocked.getArtworkDetail
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
	avatarOnboardingCompletedAt: new Date('2026-03-28T10:00:00.000Z'),
	avatarUrl: 'avatars/user-1.avif',
	email: 'journey_artist@not-the-louvre.local',
	id: 'user-1',
	nickname: 'journey_artist',
	role: 'user' as const
};

const createActionEvent = (
	fields: Record<string, string | File>,
	user: typeof authenticatedUser | null = authenticatedUser
) => {
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
		request: new Request('http://localhost/draw', {
			body: formData,
			method: 'POST'
		}),
		route: { id: '/draw' },
		setHeaders: vi.fn(),
		tracing: {} as DrawPublishActionEvent['tracing'],
		url: new URL('http://localhost/draw')
	} as unknown as DrawPublishActionEvent;
};

describe('draw route page', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.getIp.mockClear();
		mocked.getArtworkDetail.mockReset();
		mocked.publishArtwork.mockReset();
		mocked.getArtworkDetail.mockResolvedValue({
			author: { avatarUrl: null, id: 'user-9', nickname: 'parent_artist' },
			childForks: [],
			commentCount: 0,
			createdAt: new Date('2026-03-28T10:00:00.000Z'),
			forkCount: 0,
			id: 'artwork-parent',
			lineage: { isFork: false, parent: null, parentStatus: 'none' },
			mediaContentType: 'image/avif',
			mediaSizeBytes: 128,
			mediaUrl: '/api/artworks/artwork-parent/media',
			score: 5,
			title: 'Parent Artwork',
			updatedAt: new Date('2026-03-28T10:00:00.000Z')
		});
		mocked.publishArtwork.mockResolvedValue({
			authorId: 'user-1',
			commentCount: 0,
			createdAt: new Date('2026-03-28T12:00:00.000Z'),
			forkCount: 0,
			id: 'artwork-1',
			mediaContentType: 'image/avif',
			mediaSizeBytes: 128,
			parentId: null,
			score: 0,
			storageKey: 'artworks/user-1/artwork-1.avif',
			title: 'Untitled #0001',
			updatedAt: new Date('2026-03-28T12:00:00.000Z')
		});
	});

	it('redirects anonymous viewers back to the home entry flow', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ locals: {}, url: new URL('http://localhost/draw') } as never)
		).rejects.toMatchObject({
			location: '/',
			status: 302
		});
	});

	it('returns the authenticated canonical user for the draw route', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ locals: { user: authenticatedUser }, url: new URL('http://localhost/draw') } as never)
		).resolves.toMatchObject({
			user: {
				nickname: 'journey_artist'
			}
		});
	});

	it('loads fork parent artwork metadata when opening the draw route for a fork', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({
				locals: { user: authenticatedUser },
				url: new URL('http://localhost/draw?fork=artwork-parent')
			} as never)
		).resolves.toMatchObject({
			forkParent: {
				id: 'artwork-parent',
				mediaUrl: '/api/artworks/artwork-parent/media',
				title: 'Parent Artwork'
			}
		});
		expect(mocked.getArtworkDetail).toHaveBeenCalledWith('artwork-parent', {
			user: authenticatedUser
		});
	});

	it('rejects publish attempts that omit artwork media', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.publish(createActionEvent({ title: 'No media yet' }));

		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'publish',
				code: 'INVALID_MEDIA_FORMAT',
				message: 'Artwork media is required'
			}
		});
		expect(mocked.publishArtwork).not.toHaveBeenCalled();
	});

	it('returns a product-facing success payload after publishing the current drawing', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.publish(
			createActionEvent({
				media: new File([new Uint8Array([1, 2, 3])], 'artwork.png', { type: 'image/png' }),
				title: 'My First Piece'
			})
		);

		expect(mocked.publishArtwork).toHaveBeenCalledWith(
			expect.objectContaining({
				media: expect.any(File),
				title: 'My First Piece'
			}),
			expect.objectContaining({
				ipAddress: '127.0.0.1',
				user: authenticatedUser
			})
		);
		expect(result).toEqual({
			action: 'publish',
			artwork: {
				id: 'artwork-1',
				mediaUrl: '/api/artworks/artwork-1/media',
				title: 'Untitled #0001'
			},
			success: true
		});
	});

	it('passes the optional parent artwork id through publish requests', async () => {
		const { actions } = await import('./+page.server');
		await actions.publish(
			createActionEvent({
				isNsfw: 'true',
				media: new File([new Uint8Array([1, 2, 3])], 'artwork.png', { type: 'image/png' }),
				parentArtworkId: 'artwork-parent',
				title: 'Forked Piece'
			})
		);

		expect(mocked.publishArtwork).toHaveBeenCalledWith(
			expect.objectContaining({
				isNsfw: true,
				parentArtworkId: 'artwork-parent',
				title: 'Forked Piece'
			}),
			expect.anything()
		);
	});

	it('preserves backend publish failure codes and messages', async () => {
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
				media: new File([new Uint8Array([1, 2, 3])], 'artwork.jpg', { type: 'image/jpeg' }),
				title: 'Bad upload'
			})
		);

		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'publish',
				code: 'INVALID_MEDIA_FORMAT',
				message: 'Artwork media must be AVIF, WebP, JPEG, or PNG'
			}
		});
	});
});
