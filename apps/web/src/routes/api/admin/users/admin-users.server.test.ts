import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	listUsers: vi.fn(),
	updateUserRole: vi.fn()
}));

vi.mock('$lib/server/user/admin.service', () => ({
	listUsers: mocked.listUsers,
	updateUserRole: mocked.updateUserRole
}));

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
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
});

const makeUserLocals = () => ({
	user: {
		id: 'user-1',
		authUserId: 'auth-user-1',
		nickname: 'artist',
		role: 'user' as const,
		avatarUrl: null,
		name: 'artist',
		email: 'artist@not-the-louvre.local',
		emailVerified: false,
		image: null,
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
});

describe('GET /api/admin/users', () => {
	beforeEach(() => {
		mocked.listUsers.mockReset();
	});

	it('returns paginated user list for admin', async () => {
		mocked.listUsers.mockResolvedValue({
			items: [
				{
					avatarUrl: '/api/users/user-1/avatar',
					createdAt: '2026-01-01T00:00:00.000Z',
					id: 'user-1',
					nickname: 'artist',
					role: 'user'
				}
			],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/admin/users');
		const response = await GET({ locals: makeAdminLocals(), url } as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.items).toHaveLength(1);
		expect(json.pageInfo.hasMore).toBe(false);
	});

	it('rejects non-admin access', async () => {
		mocked.listUsers.mockRejectedValue(
			new ArtworkFlowError(403, 'Admin access required', 'FORBIDDEN')
		);

		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/admin/users');
		const response = await GET({ locals: makeUserLocals(), url } as never);

		expect(response.status).toBe(403);
	});

	it('rejects unauthenticated access', async () => {
		mocked.listUsers.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/admin/users');
		const response = await GET({ locals: { user: null }, url } as never);

		expect(response.status).toBe(401);
	});

	it('passes cursor from query parameter', async () => {
		mocked.listUsers.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const cursor = Buffer.from(
			JSON.stringify({ createdAt: '2026-01-01T00:00:00.000Z', id: 'user-1' }),
			'utf8'
		).toString('base64url');

		const { GET } = await import('./+server');
		const url = new URL(`http://localhost/api/admin/users?cursor=${cursor}`);
		await GET({ locals: makeAdminLocals(), url } as never);

		expect(mocked.listUsers).toHaveBeenCalledWith(
			expect.objectContaining({ cursor }),
			expect.anything()
		);
	});
});

describe('PATCH /api/admin/users/[userId]', () => {
	beforeEach(() => {
		mocked.updateUserRole.mockReset();
	});

	it('promotes a user to moderator', async () => {
		mocked.updateUserRole.mockResolvedValue({
			avatarUrl: null,
			createdAt: '2026-01-01T00:00:00.000Z',
			id: 'user-1',
			nickname: 'artist',
			role: 'moderator'
		});

		const { PATCH } = await import('./[userId]/+server');
		const response = await PATCH({
			locals: makeAdminLocals(),
			params: { userId: 'user-1' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role: 'moderator' })
			})
		} as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.role).toBe('moderator');
	});

	it('rejects self-role change', async () => {
		mocked.updateUserRole.mockRejectedValue(
			new ArtworkFlowError(403, 'Cannot change your own role', 'FORBIDDEN')
		);

		const { PATCH } = await import('./[userId]/+server');
		const response = await PATCH({
			locals: makeAdminLocals(),
			params: { userId: 'admin-1' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role: 'user' })
			})
		} as never);

		expect(response.status).toBe(403);
	});

	it('rejects non-admin access', async () => {
		mocked.updateUserRole.mockRejectedValue(
			new ArtworkFlowError(403, 'Admin access required', 'FORBIDDEN')
		);

		const { PATCH } = await import('./[userId]/+server');
		const response = await PATCH({
			locals: makeUserLocals(),
			params: { userId: 'user-2' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role: 'moderator' })
			})
		} as never);

		expect(response.status).toBe(403);
	});

	it('returns 404 for nonexistent user', async () => {
		mocked.updateUserRole.mockRejectedValue(
			new ArtworkFlowError(404, 'User not found', 'NOT_FOUND')
		);

		const { PATCH } = await import('./[userId]/+server');
		const response = await PATCH({
			locals: makeAdminLocals(),
			params: { userId: 'unknown' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role: 'moderator' })
			})
		} as never);

		expect(response.status).toBe(404);
	});
});
