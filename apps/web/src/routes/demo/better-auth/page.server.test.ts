import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	signOut: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		api: {
			signOut: mocked.signOut
		}
	}
}));

describe('authenticated nickname demo page', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.signOut.mockReset();
	});

	it('returns canonical authenticated user data to the page load', async () => {
		const { load } = await import('./+page.server');
		const result = await load({
			locals: {
				authUser: { id: 'auth-user-1' },
				user: {
					id: 'product-user-1',
					authUserId: 'auth-user-1',
					nickname: 'artist_1',
					role: 'user',
					email: 'artist_1@not-the-louvre.local'
				}
			},
			url: new URL('http://localhost/demo/better-auth')
		} as never);

		expect(result).toMatchObject({
			user: {
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			}
		});
	});

	it('throws an integrity error when the session is missing its companion product user', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({
				locals: {
					integrityFailure: {
						reason: 'missing-product-user'
					}
				},
				url: new URL('http://localhost/demo/better-auth')
			} as never)
		).rejects.toMatchObject({
			status: 500
		});
	});

	it('redirects anonymous requests to the login page', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({
				locals: {},
				url: new URL('http://localhost/demo/better-auth')
			} as never)
		).rejects.toMatchObject({
			location: '/demo/better-auth/login',
			status: 302
		});
	});

	it('invalidates the current session on sign out', async () => {
		const { actions } = await import('./+page.server');
		mocked.signOut.mockResolvedValue(undefined);

		await expect(
			actions.signOut({
				request: new Request('http://localhost/demo/better-auth', {
					headers: new Headers({ cookie: 'session=abc' })
				})
			} as never)
		).rejects.toMatchObject({
			location: '/demo/better-auth/login',
			status: 302
		});

		expect(mocked.signOut).toHaveBeenCalledWith({
			headers: expect.any(Headers)
		});
	});
});
