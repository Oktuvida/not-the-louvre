import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	banUser: vi.fn(),
	unbanUser: vi.fn()
}));

vi.mock('$lib/server/user/admin.service', async () => {
	const actual = await vi.importActual<object>('$lib/server/user/admin.service');
	return {
		...actual,
		banUser: mocked.banUser,
		unbanUser: mocked.unbanUser
	};
});

const makeAdminLocals = () => ({
	user: {
		id: 'admin-1',
		authUserId: 'auth-admin-1',
		nickname: 'admin',
		role: 'admin' as const,
		avatarUrl: null,
		name: 'admin',
		email: 'admin@not-the-louvre.local',
		emailVerified: false,
		image: null,
		isBanned: false,
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
});

describe('PATCH /api/admin/users/[userId]/ban', () => {
	beforeEach(() => {
		mocked.banUser.mockReset();
		mocked.unbanUser.mockReset();
	});

	it('bans a user with a reason', async () => {
		mocked.banUser.mockResolvedValue({ id: 'user-1', isBanned: true, banReason: 'harassment' });

		const { PATCH } = await import('./+server');
		const response = await PATCH({
			locals: makeAdminLocals(),
			params: { userId: 'user-1' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'ban', reason: 'harassment' })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.banUser).toHaveBeenCalledWith(
			{ reason: 'harassment', userId: 'user-1' },
			expect.objectContaining({ user: makeAdminLocals().user })
		);
	});

	it('unbans a user', async () => {
		mocked.unbanUser.mockResolvedValue({ id: 'user-1', isBanned: false, banReason: null });

		const { PATCH } = await import('./+server');
		const response = await PATCH({
			locals: makeAdminLocals(),
			params: { userId: 'user-1' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'unban' })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.unbanUser).toHaveBeenCalledWith(
			{ userId: 'user-1' },
			expect.objectContaining({ user: makeAdminLocals().user })
		);
	});

	it('returns domain errors for invalid ban attempts', async () => {
		mocked.banUser.mockRejectedValue(new ArtworkFlowError(403, 'Cannot ban yourself', 'FORBIDDEN'));

		const { PATCH } = await import('./+server');
		const response = await PATCH({
			locals: makeAdminLocals(),
			params: { userId: 'admin-1' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'ban', reason: 'oops' })
			})
		} as never);

		expect(response.status).toBe(403);
	});
});
