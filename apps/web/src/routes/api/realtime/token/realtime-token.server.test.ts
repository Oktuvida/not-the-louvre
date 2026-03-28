import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	createRealtimeAuthToken: vi.fn()
}));

vi.mock('$lib/server/realtime/auth', () => ({
	createRealtimeAuthToken: mocked.createRealtimeAuthToken
}));

describe('GET /api/realtime/token', () => {
	beforeEach(() => {
		mocked.createRealtimeAuthToken.mockReset();
	});

	it('returns an unauthenticated error when no canonical user is present', async () => {
		const { GET } = await import('./+server');
		const response = await GET({ locals: {} } as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
		expect(mocked.createRealtimeAuthToken).not.toHaveBeenCalled();
	});

	it('returns a short-lived supabase-compatible token for the signed-in user', async () => {
		mocked.createRealtimeAuthToken.mockResolvedValue({
			expiresAt: '2026-03-28T16:30:00.000Z',
			token: 'signed-realtime-token'
		});

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {
				user: {
					authUserId: 'auth-user-1',
					email: 'observer@not-the-louvre.local',
					id: 'user-1',
					nickname: 'observer',
					role: 'user'
				}
			}
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			expiresAt: '2026-03-28T16:30:00.000Z',
			token: 'signed-realtime-token'
		});
		expect(mocked.createRealtimeAuthToken).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'user-1', role: 'user' })
		);
	});
});
