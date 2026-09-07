import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	findUserAvatarRefById: vi.fn()
}));

vi.mock('$lib/server/user/repository', () => ({
	userRepository: {
		findUserAvatarRefById: mocked.findUserAvatarRefById,
		updateUserAvatarUrl: vi.fn()
	}
}));

describe('GET /api/users/[userId]', () => {
	beforeEach(() => {
		mocked.findUserAvatarRefById.mockReset();
	});

	it('returns the public profile for an existing user', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue({
			avatarUrl: 'avatars/user-1.avif',
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			id: 'user-1',
			nickname: 'artist',
			role: 'user',
			updatedAt: new Date('2026-01-01T00:00:00.000Z')
		});

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json).toMatchObject({
			id: 'user-1',
			nickname: 'artist',
			avatarUrl: '/api/users/user-1/avatar',
			role: 'user'
		});
		expect(json.createdAt).toBeDefined();
		expect(json).not.toHaveProperty('updatedAt');
		expect(json).not.toHaveProperty('recoveryHash');
	});

	it('returns null avatar URL when user has no avatar', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue({
			avatarUrl: null,
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			id: 'user-2',
			nickname: 'lurker',
			role: 'user',
			updatedAt: new Date('2026-01-01T00:00:00.000Z')
		});

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-2' }
		} as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.avatarUrl).toBeNull();
	});

	it('returns 404 for a nonexistent user', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(null);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'unknown' }
		} as never);

		expect(response.status).toBe(404);
	});

	it('does not require authentication', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue({
			avatarUrl: null,
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			id: 'user-1',
			nickname: 'artist',
			role: 'user',
			updatedAt: new Date('2026-01-01T00:00:00.000Z')
		});

		const { GET } = await import('./+server');
		const response = await GET({
			locals: { user: null },
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(200);
	});
});
