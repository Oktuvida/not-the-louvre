import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	resolveSessionContext: vi.fn(),
	svelteKitHandler: vi.fn(async ({ event, resolve }) => resolve(event)),
	logSecurityEvent: vi.fn()
}));

vi.mock('$app/environment', () => ({
	building: false
}));

vi.mock('$lib/server/auth', () => ({
	auth: {}
}));

vi.mock('$lib/server/auth/service', () => ({
	resolveSessionContext: mocked.resolveSessionContext
}));

vi.mock('$lib/server/security/logging', () => ({
	logSecurityEvent: mocked.logSecurityEvent
}));

vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: mocked.svelteKitHandler
}));

describe('server handle hardening', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.resolveSessionContext.mockReset();
		mocked.svelteKitHandler.mockReset();
		mocked.svelteKitHandler.mockImplementation(async ({ event, resolve }) => resolve(event));
		mocked.logSecurityEvent.mockReset();
	});

	it('treats invalid sessions as unauthenticated for downstream authenticated routes', async () => {
		mocked.resolveSessionContext.mockResolvedValue(null);

		const { handle } = await import('./hooks.server');
		const response = await handle({
			event: {
				locals: {},
				request: new Request('http://localhost/api/artworks', {
					headers: { origin: 'http://localhost' },
					method: 'POST'
				}),
				route: { id: '/api/artworks' },
				url: new URL('http://localhost/api/artworks')
			},
			resolve: vi.fn(async (event) => new Response(null, { status: event.locals.user ? 201 : 401 }))
		} as never);

		expect(response.status).toBe(401);
	});

	it('logs integrity failures while preserving the explicit integrity state', async () => {
		mocked.resolveSessionContext.mockResolvedValue({
			authUser: { id: 'auth-user-1' },
			reason: 'missing-product-user',
			session: { id: 'session-1' }
		});

		const { handle } = await import('./hooks.server');
		const response = await handle({
			event: {
				locals: {},
				request: new Request('http://localhost/demo/better-auth'),
				route: { id: '/demo/better-auth' },
				url: new URL('http://localhost/demo/better-auth')
			},
			resolve: vi.fn(async () => new Response(null, { status: 200 }))
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.logSecurityEvent).toHaveBeenCalledWith(
			'auth.integrity_failure',
			expect.objectContaining({
				reason: 'missing-product-user'
			})
		);
	});

	it('rejects unsafe cross-site mutation requests before product code runs', async () => {
		const resolve = vi.fn(async () => new Response(null, { status: 200 }));

		const { handle } = await import('./hooks.server');
		const response = await handle({
			event: {
				locals: {},
				request: new Request('http://localhost/api/artworks/artwork-1/vote', {
					headers: { origin: 'https://evil.example' },
					method: 'POST'
				}),
				route: { id: '/api/artworks/[artworkId]/vote' },
				url: new URL('http://localhost/api/artworks/artwork-1/vote')
			},
			resolve
		} as never);

		expect(response.status).toBe(403);
		expect(resolve).not.toHaveBeenCalled();
		expect(mocked.logSecurityEvent).toHaveBeenCalledWith(
			'http.untrusted_origin_blocked',
			expect.objectContaining({
				origin: 'https://evil.example',
				pathname: '/api/artworks/artwork-1/vote'
			})
		);
	});

	it('allows trusted local mutation requests to continue', async () => {
		mocked.resolveSessionContext.mockResolvedValue(null);

		const resolve = vi.fn(async () => new Response(null, { status: 201 }));
		const { handle } = await import('./hooks.server');
		const response = await handle({
			event: {
				locals: {},
				request: new Request('http://localhost/api/artworks/artwork-1/vote', {
					headers: { origin: 'http://localhost' },
					method: 'POST'
				}),
				route: { id: '/api/artworks/[artworkId]/vote' },
				url: new URL('http://localhost/api/artworks/artwork-1/vote')
			},
			resolve
		} as never);

		expect(response.status).toBe(201);
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('allows configured trusted origins to continue', async () => {
		vi.stubEnv('ORIGIN', 'https://not-the-louvre.example');
		mocked.resolveSessionContext.mockResolvedValue(null);

		const resolve = vi.fn(async () => new Response(null, { status: 201 }));
		const { handle } = await import('./hooks.server');
		const response = await handle({
			event: {
				locals: {},
				request: new Request('http://localhost/api/artworks', {
					headers: { origin: 'https://not-the-louvre.example' },
					method: 'POST'
				}),
				route: { id: '/api/artworks' },
				url: new URL('http://localhost/api/artworks')
			},
			resolve
		} as never);

		expect(response.status).toBe(201);
		expect(resolve).toHaveBeenCalledOnce();
		vi.unstubAllEnvs();
	});
});

describe('session resolution allowlist', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.resolveSessionContext.mockReset();
		mocked.resolveSessionContext.mockResolvedValue(null);
		mocked.svelteKitHandler.mockReset();
		mocked.svelteKitHandler.mockImplementation(async ({ event, resolve }) => resolve(event));
		mocked.logSecurityEvent.mockReset();
	});

	const runHandle = async (routeId: string, method: string, pathname: string) => {
		const { handle } = await import('./hooks.server');

		return handle({
			event: {
				locals: {},
				platform: undefined,
				request: new Request(`http://localhost${pathname}`, {
					headers: { origin: 'http://localhost' },
					method
				}),
				route: { id: routeId },
				url: new URL(`http://localhost${pathname}`)
			},
			resolve: vi.fn(async () => new Response(null, { status: 200 }))
		} as never);
	};

	it.each([
		['/api/artworks/[artworkId]/media', '/api/artworks/artwork-1/media'],
		['/api/users/[userId]/avatar', '/api/users/user-1/avatar'],
		['/api/users/[userId]/favicon', '/api/users/user-1/favicon']
	])('skips session resolution for GET %s', async (routeId, pathname) => {
		const response = await runHandle(routeId, 'GET', pathname);

		expect(response.status).toBe(200);
		expect(mocked.resolveSessionContext).not.toHaveBeenCalled();
	});

	it('still resolves the session for writes on an allowlisted route', async () => {
		await runHandle('/api/users/[userId]/avatar', 'POST', '/api/users/user-1/avatar');

		expect(mocked.resolveSessionContext).toHaveBeenCalledOnce();
	});

	it('still resolves the session for GET requests outside the allowlist', async () => {
		await runHandle('/api/artworks', 'GET', '/api/artworks');

		expect(mocked.resolveSessionContext).toHaveBeenCalledOnce();
	});

	it('resolves the session when the route could not be matched', async () => {
		await runHandle(null as unknown as string, 'GET', '/api/artworks/artwork-1/media');

		expect(mocked.resolveSessionContext).toHaveBeenCalledOnce();
	});
});
