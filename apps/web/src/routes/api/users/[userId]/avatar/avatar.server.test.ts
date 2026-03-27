import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { UserRecord } from '$lib/server/user/types';

const mocked = vi.hoisted(() => ({
	avatarService: {
		uploadAvatar: vi.fn(),
		deleteAvatar: vi.fn()
	},
	findUserById: vi.fn(),
	streamAvatarStorageObject: vi.fn()
}));

vi.mock('$lib/server/user/avatar.service', () => ({
	avatarService: mocked.avatarService
}));

vi.mock('$lib/server/user/repository', () => ({
	userRepository: {
		findUserById: mocked.findUserById,
		updateUserAvatarUrl: vi.fn()
	}
}));

vi.mock('$lib/server/user/storage', () => ({
	streamAvatarStorageObject: mocked.streamAvatarStorageObject
}));

const makeUserRecord = (overrides: Partial<UserRecord> = {}): UserRecord => ({
	avatarUrl: 'avatars/user-1.avif',
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	id: 'user-1',
	nickname: 'artist',
	role: 'user',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

const makeLocalUser = (overrides = {}) => ({
	avatarUrl: null,
	authUserId: 'auth-user-1',
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	email: 'artist@not-the-louvre.local',
	emailVerified: false,
	id: 'user-1',
	image: null,
	name: 'artist',
	nickname: 'artist',
	role: 'user',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

describe('GET /api/users/[userId]/avatar', () => {
	beforeEach(() => {
		mocked.findUserById.mockReset();
		mocked.streamAvatarStorageObject.mockReset();
	});

	it('streams the avatar for a user with an uploaded avatar', async () => {
		mocked.findUserById.mockResolvedValue(makeUserRecord({ avatarUrl: 'avatars/user-1.avif' }));
		mocked.streamAvatarStorageObject.mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]), { status: 200 })
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/avif');
		expect(response.headers.get('cache-control')).toMatch(/public/);
		expect(mocked.streamAvatarStorageObject).toHaveBeenCalledWith('avatars/user-1.avif');
	});

	it('returns 404 for a user without an avatar', async () => {
		mocked.findUserById.mockResolvedValue(makeUserRecord({ avatarUrl: null }));

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(404);
	});

	it('returns 404 for a nonexistent user', async () => {
		mocked.findUserById.mockResolvedValue(null);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'unknown-user' }
		} as never);

		expect(response.status).toBe(404);
	});
});

describe('PUT /api/users/[userId]/avatar', () => {
	beforeEach(() => {
		mocked.avatarService.uploadAvatar.mockReset();
	});

	it('uploads and returns the updated profile', async () => {
		const updated = makeUserRecord({ avatarUrl: 'avatars/user-1.avif' });
		mocked.avatarService.uploadAvatar.mockResolvedValue(updated);

		const formData = new FormData();
		formData.append('file', new File([new Uint8Array(128)], 'avatar.avif', { type: 'image/avif' }));

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', { method: 'PUT', body: formData })
		} as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.avatarUrl).toBe('avatars/user-1.avif');
	});

	it('returns 401 for unauthenticated upload attempts', async () => {
		mocked.avatarService.uploadAvatar.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const formData = new FormData();
		formData.append('file', new File([new Uint8Array(128)], 'avatar.avif', { type: 'image/avif' }));

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: null },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', { method: 'PUT', body: formData })
		} as never);

		expect(response.status).toBe(401);
	});

	it('returns 400 for invalid media format', async () => {
		mocked.avatarService.uploadAvatar.mockRejectedValue(
			new ArtworkFlowError(400, 'Avatar media must be AVIF', 'INVALID_MEDIA_FORMAT')
		);

		const formData = new FormData();
		formData.append('file', new File([new Uint8Array(128)], 'avatar.png', { type: 'image/png' }));

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', { method: 'PUT', body: formData })
		} as never);

		expect(response.status).toBe(400);
	});
});

describe('DELETE /api/users/[userId]/avatar', () => {
	beforeEach(() => {
		mocked.avatarService.deleteAvatar.mockReset();
	});

	it('deletes the avatar and returns the updated profile', async () => {
		const updated = makeUserRecord({ avatarUrl: null });
		mocked.avatarService.deleteAvatar.mockResolvedValue(updated);

		const { DELETE } = await import('./+server');
		const response = await DELETE({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.avatarUrl).toBeNull();
	});

	it('returns 401 for unauthenticated delete attempts', async () => {
		mocked.avatarService.deleteAvatar.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const { DELETE } = await import('./+server');
		const response = await DELETE({
			locals: { user: null },
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(401);
	});
});
