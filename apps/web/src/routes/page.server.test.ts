import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actions } from './$types';
import { AuthFlowError } from '$lib/server/auth/errors';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	createEmptyDrawingDocument,
	serializeDrawingDocument
} from '$lib/features/stroke-json/document';

type HomeActionEvent = Parameters<Actions['signUp']>[0];

const mocked = vi.hoisted(() => ({
	getIp: vi.fn(() => '127.0.0.1'),
	getNicknameAvailability: vi.fn(),
	listArtworkDiscovery: vi.fn(),
	recoverAccount: vi.fn(),
	uploadAvatar: vi.fn(),
	signInWithNickname: vi.fn(),
	signOutCurrentSession: vi.fn(),
	signUpWithNickname: vi.fn()
}));

vi.mock('$lib/server/auth/service', () => ({
	getNicknameAvailability: mocked.getNicknameAvailability,
	recoverAccount: mocked.recoverAccount,
	signInWithNickname: mocked.signInWithNickname,
	signOutCurrentSession: mocked.signOutCurrentSession,
	signUpWithNickname: mocked.signUpWithNickname
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		options: {}
	}
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	listArtworkDiscovery: mocked.listArtworkDiscovery
}));

vi.mock('$lib/server/user/avatar.service', () => ({
	avatarService: {
		uploadAvatar: mocked.uploadAvatar
	}
}));

vi.mock('better-auth/api', () => ({
	getIp: mocked.getIp
}));

const createEvent = (
	fields: Record<string, string> = {},
	overrides: Partial<HomeActionEvent> = {}
) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}

	return {
		locals: {},
		cookies: {} as RequestEvent['cookies'],
		fetch,
		getClientAddress: () => '127.0.0.1',
		isDataRequest: false,
		isRemoteRequest: false,
		isSubRequest: false,
		params: {},
		platform: undefined,
		request: new Request('http://localhost/', {
			method: 'POST',
			body: formData
		}),
		route: { id: '/' },
		setHeaders: vi.fn(),
		tracing: {} as HomeActionEvent['tracing'],
		url: new URL('http://localhost/'),
		...overrides
	} as unknown as HomeActionEvent;
};

describe('home route auth contract', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.getIp.mockClear();
		mocked.getNicknameAvailability.mockReset();
		mocked.listArtworkDiscovery.mockReset();
		mocked.recoverAccount.mockReset();
		mocked.uploadAvatar.mockReset();
		mocked.signInWithNickname.mockReset();
		mocked.signOutCurrentSession.mockReset();
		mocked.signUpWithNickname.mockReset();
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [
				{
					author: { avatarUrl: null, id: 'artist-1', nickname: 'PaintMaster42' },
					commentCount: 0,
					createdAt: new Date('2026-03-28T10:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-1',
					lineage: { isFork: false, parent: null, parentStatus: 'none' },
					mediaUrl: '/api/artworks/artwork-1/media',
					score: 42,
					title: 'Sunset Over Mountains'
				}
			],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'top'
		});
	});

	it('returns a signed-out bootstrap when the request has no session', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ locals: {}, url: new URL('http://localhost/') } as never)
		).resolves.toMatchObject({
			auth: {
				status: 'signed-out',
				user: null,
				integrityFailure: null
			},
			topArtworks: [
				{
					title: 'Sunset Over Mountains'
				}
			]
		});
		expect(mocked.listArtworkDiscovery).toHaveBeenCalledWith(
			{ cursor: null, limit: 3, sort: 'top', window: 'all' },
			{ user: undefined }
		);
	});

	it('returns an empty homepage teaser when top-ranked discovery has no artworks', async () => {
		mocked.listArtworkDiscovery.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null },
			sort: 'top'
		});

		const { load } = await import('./+page.server');

		await expect(
			load({ locals: {}, url: new URL('http://localhost/') } as never)
		).resolves.toMatchObject({
			topArtworks: []
		});
	});

	it('returns an authenticated bootstrap from canonical server user data', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({
				locals: {
					user: {
						id: 'product-user-1',
						authUserId: 'auth-user-1',
						avatarOnboardingCompletedAt: new Date('2026-03-28T10:00:00.000Z'),
						nickname: 'artist_1',
						role: 'user',
						email: 'artist_1@not-the-louvre.local'
					}
				},
				url: new URL('http://localhost/')
			} as never)
		).resolves.toMatchObject({
			auth: {
				onboarding: {
					status: 'complete'
				},
				status: 'authenticated',
				user: {
					nickname: 'artist_1'
				}
			}
		});
	});

	it('returns avatar-onboarding bootstrap for authenticated users who have not completed signup onboarding', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({
				locals: {
					user: {
						id: 'product-user-2',
						authUserId: 'auth-user-2',
						avatarOnboardingCompletedAt: null,
						nickname: 'unfinished_artist',
						role: 'user',
						email: 'unfinished_artist@not-the-louvre.local'
					}
				},
				url: new URL('http://localhost/')
			} as never)
		).resolves.toMatchObject({
			auth: {
				onboarding: {
					status: 'needs-avatar'
				},
				status: 'authenticated',
				user: {
					nickname: 'unfinished_artist'
				}
			}
		});
	});

	it('returns a safe integrity-failure bootstrap when the auth session is inconsistent', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({
				locals: {
					integrityFailure: {
						authUser: { id: 'auth-user-1' },
						reason: 'missing-product-user',
						session: { id: 'session-1' }
					}
				},
				url: new URL('http://localhost/')
			} as never)
		).resolves.toMatchObject({
			auth: {
				status: 'integrity-failure',
				user: null,
				integrityFailure: {
					reason: 'missing-product-user'
				}
			}
		});
	});

	it('returns backend auth failures from sign in without losing the domain code', async () => {
		mocked.signInWithNickname.mockRejectedValue(
			new AuthFlowError(401, 'Invalid nickname or password', 'INVALID_CREDENTIALS')
		);

		const { actions } = await import('./+page.server');
		const result = await actions.signIn(
			createEvent({ nickname: 'artist_1', password: 'password123' })
		);

		expect(result).toMatchObject({
			status: 401,
			data: {
				action: 'signIn',
				code: 'INVALID_CREDENTIALS',
				message: 'Invalid nickname or password'
			}
		});
	});

	it('signs in through the canonical auth service and updates locals for the rerendered load', async () => {
		mocked.signInWithNickname.mockResolvedValue({
			response: {
				user: {
					id: 'product-user-1',
					authUserId: 'auth-user-1',
					avatarOnboardingCompletedAt: new Date('2026-03-28T10:00:00.000Z'),
					nickname: 'artist_1',
					role: 'user',
					email: 'artist_1@not-the-louvre.local'
				}
			}
		});

		const { actions } = await import('./+page.server');
		const event = createEvent({ nickname: 'artist_1', password: 'password123' });
		const result = await actions.signIn(event);

		expect(mocked.signInWithNickname).toHaveBeenCalledWith(
			{ nickname: 'artist_1', password: 'password123' },
			'127.0.0.1',
			event.request.headers
		);
		expect(event.locals.user).toMatchObject({ nickname: 'artist_1' });
		expect(result).toEqual({ action: 'signIn', success: true });
	});

	it('returns the backend-issued signup recovery key and updates locals on success', async () => {
		mocked.signUpWithNickname.mockResolvedValue({
			response: {
				recoveryKey: 'signup-recovery-key',
				user: {
					id: 'product-user-1',
					authUserId: 'auth-user-1',
					avatarOnboardingCompletedAt: null,
					nickname: 'fresh_artist',
					role: 'user',
					email: 'fresh_artist@not-the-louvre.local'
				}
			}
		});

		const { actions } = await import('./+page.server');
		const event = createEvent({ nickname: 'fresh_artist', password: 'password123' });
		const result = await actions.signUp(event);

		expect(event.locals.user).toMatchObject({ nickname: 'fresh_artist' });
		expect(result).toEqual({
			action: 'signUp',
			onboarding: 'needs-avatar',
			recoveryKey: 'signup-recovery-key',
			success: true
		});
	});

	it('saves an avatar through the home route action and marks onboarding complete', async () => {
		mocked.uploadAvatar.mockResolvedValue({
			avatarOnboardingCompletedAt: new Date('2026-03-28T12:00:00.000Z'),
			avatarUrl: 'avatars/product-user-1.avif',
			createdAt: new Date('2026-03-28T10:00:00.000Z'),
			id: 'product-user-1',
			nickname: 'fresh_artist',
			role: 'user',
			updatedAt: new Date('2026-03-28T12:00:00.000Z')
		});

		const { actions } = await import('./+page.server');
		const avatarDocument = serializeDrawingDocument(createEmptyDrawingDocument('avatar'));
		const localUser = {
			id: 'product-user-1',
			authUserId: 'auth-user-1',
			avatarOnboardingCompletedAt: null,
			nickname: 'fresh_artist',
			role: 'user',
			email: 'fresh_artist@not-the-louvre.local'
		};
		const event = createEvent(
			{},
			{
				locals: {
					user: localUser
				} as never,
				request: new Request('http://localhost/', {
					method: 'POST',
					body: (() => {
						const formData = new FormData();
						formData.set('drawingDocument', avatarDocument);
						return formData;
					})()
				})
			}
		);

		const result = await actions.saveAvatar(event as never);

		expect(mocked.uploadAvatar).toHaveBeenCalledWith(localUser, avatarDocument);
		expect(event.locals.user).toMatchObject({
			avatarOnboardingCompletedAt: new Date('2026-03-28T12:00:00.000Z'),
			avatarUrl: 'avatars/product-user-1.avif'
		});
		expect(result).toEqual({
			action: 'saveAvatar',
			avatarUrl: '/api/users/product-user-1/avatar?v=1774699200000',
			onboarding: 'complete',
			success: true
		});
	});

	it('returns backend avatar save failures without dropping the domain code', async () => {
		mocked.uploadAvatar.mockRejectedValue(
			new ArtworkFlowError(400, 'Avatar media must be WebP', 'INVALID_MEDIA_FORMAT')
		);

		const { actions } = await import('./+page.server');
		const formData = new FormData();
		formData.set('drawingDocument', serializeDrawingDocument(createEmptyDrawingDocument('avatar')));

		const result = await actions.saveAvatar(
			createEvent(
				{},
				{
					locals: {
						user: {
							id: 'product-user-1',
							authUserId: 'auth-user-1',
							avatarOnboardingCompletedAt: null,
							nickname: 'fresh_artist',
							role: 'user',
							email: 'fresh_artist@not-the-louvre.local'
						}
					} as never,
					request: new Request('http://localhost/', { method: 'POST', body: formData })
				}
			) as never
		);

		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'saveAvatar',
				code: 'INVALID_MEDIA_FORMAT',
				message: 'Avatar media must be WebP'
			}
		});
	});

	it('maps nickname availability results without inventing frontend-only state', async () => {
		mocked.getNicknameAvailability
			.mockResolvedValueOnce({ available: true, valid: true })
			.mockResolvedValueOnce({ available: false, valid: true })
			.mockResolvedValueOnce({ available: false, valid: false });

		const { actions } = await import('./+page.server');

		await expect(actions.checkNickname(createEvent({ nickname: 'artist_1' }))).resolves.toEqual({
			action: 'checkNickname',
			availability: 'available'
		});
		await expect(actions.checkNickname(createEvent({ nickname: 'artist_1' }))).resolves.toEqual({
			action: 'checkNickname',
			availability: 'taken'
		});
		await expect(actions.checkNickname(createEvent({ nickname: 'artist_1' }))).resolves.toEqual({
			action: 'checkNickname',
			availability: 'invalid'
		});
	});

	it('returns the rotated recovery key from the backend on recovery success', async () => {
		mocked.recoverAccount.mockResolvedValue({ recoveryKey: 'rotated-recovery-key' });

		const { actions } = await import('./+page.server');
		const result = await actions.recover(
			createEvent({
				newPassword: 'newpassword123',
				nickname: 'artist_1',
				recoveryKey: '12345678-1234-1234-1234-123456789012'
			})
		);

		expect(result).toEqual({
			action: 'recover',
			recoveryKey: 'rotated-recovery-key',
			rotatedRecoveryKey: 'rotated-recovery-key',
			success: true
		});
	});

	it('signs out through the auth service and clears the canonical local session state', async () => {
		mocked.signOutCurrentSession.mockResolvedValue(undefined);

		const { actions } = await import('./+page.server');
		const event = createEvent(
			{},
			{
				locals: {
					authUser: { id: 'auth-user-1' },
					session: { id: 'session-1' },
					user: {
						id: 'product-user-1',
						authUserId: 'auth-user-1',
						avatarOnboardingCompletedAt: new Date('2026-03-28T10:00:00.000Z'),
						nickname: 'artist_1',
						role: 'user',
						email: 'artist_1@not-the-louvre.local'
					}
				} as never
			}
		);

		const result = await actions.signOut(event);

		expect(mocked.signOutCurrentSession).toHaveBeenCalledWith(event.request.headers);
		expect(event.locals.user).toBeUndefined();
		expect(event.locals.authUser).toBeUndefined();
		expect(event.locals.session).toBeUndefined();
		expect(result).toEqual({ action: 'signOut', success: true });
	});
});
