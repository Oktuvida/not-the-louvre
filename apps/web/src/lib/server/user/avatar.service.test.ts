import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_MEDIA_MAX_BYTES } from './config';
import { createAvatarService } from './avatar.service';
import type { UserRecord, UserRepository } from './types';
import type { ArtworkStorage } from '$lib/server/artwork/types';
import type { CanonicalUser } from '$lib/server/auth/types';

const createAvifFile = (size = 128, type = 'image/avif') => {
	const bytes = new Uint8Array(size);
	bytes.set([
		0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
		0x6d, 0x69, 0x66, 0x31
	]);
	return new File([bytes], 'avatar.avif', { type });
};

const createPngFile = (size = 128) =>
	new File([new Uint8Array(size)], 'avatar.png', { type: 'image/png' });

const makeUserRecord = (overrides: Partial<UserRecord> = {}): UserRecord => ({
	avatarUrl: null,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	id: 'user-1',
	nickname: 'artist',
	role: 'user',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

const makeCanonicalUser = (overrides: Partial<CanonicalUser> = {}): CanonicalUser => ({
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

const createRepository = (initial: UserRecord | null = null): UserRepository => {
	let stored = initial;

	return {
		findUserById: vi.fn(async (id) => (stored?.id === id ? stored : null)),
		listUsers: vi.fn(async () => []),
		updateUserAvatarUrl: vi.fn(async (id, avatarUrl, updatedAt) => {
			if (!stored || stored.id !== id) return null;
			stored = { ...stored, avatarUrl, updatedAt };
			return stored;
		}),
		updateUserRole: vi.fn(async () => null)
	};
};

const createStorage = (): ArtworkStorage => ({
	upload: vi.fn(async () => {}),
	delete: vi.fn(async () => {})
});

describe('avatar upload', () => {
	let repository: UserRepository;
	let storage: ArtworkStorage;

	beforeEach(() => {
		repository = createRepository(makeUserRecord());
		storage = createStorage();
	});

	it('rejects unauthenticated requests', async () => {
		const service = createAvatarService({ repository, storage });

		await expect(service.uploadAvatar(null, createAvifFile())).rejects.toMatchObject({
			code: 'UNAUTHENTICATED',
			status: 401
		});
	});

	it('rejects non-AVIF media', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser();

		await expect(service.uploadAvatar(user, createPngFile())).rejects.toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			status: 400
		});
	});

	it('rejects media that exceeds the size budget', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser();
		const oversized = createAvifFile(AVATAR_MEDIA_MAX_BYTES + 1);

		await expect(service.uploadAvatar(user, oversized)).rejects.toMatchObject({
			code: 'MEDIA_TOO_LARGE',
			status: 400
		});
	});

	it('stores the avatar and updates the user profile on valid upload', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1' });

		const result = await service.uploadAvatar(user, createAvifFile());

		expect(storage.upload).toHaveBeenCalledWith('avatars/user-1.avif', expect.any(File));
		expect(result.avatarUrl).toBe('avatars/user-1.avif');
	});

	it('overwrites the previous avatar key in place without a separate deletion', async () => {
		repository = createRepository(makeUserRecord({ avatarUrl: 'avatars/user-1.avif' }));
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: 'avatars/user-1.avif' });

		const result = await service.uploadAvatar(user, createAvifFile());

		expect(storage.upload).toHaveBeenCalledWith('avatars/user-1.avif', expect.any(File));
		expect(storage.delete).not.toHaveBeenCalled();
		expect(result.avatarUrl).toBe('avatars/user-1.avif');
	});

	it('does not call storage delete on first upload', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: null });

		await service.uploadAvatar(user, createAvifFile());

		expect(storage.delete).not.toHaveBeenCalled();
	});
});

describe('avatar deletion', () => {
	let repository: UserRepository;
	let storage: ArtworkStorage;

	beforeEach(() => {
		repository = createRepository(makeUserRecord({ avatarUrl: 'avatars/user-1.avif' }));
		storage = createStorage();
	});

	it('rejects unauthenticated requests', async () => {
		const service = createAvatarService({ repository, storage });

		await expect(service.deleteAvatar(null)).rejects.toMatchObject({
			code: 'UNAUTHENTICATED',
			status: 401
		});
	});

	it('removes the avatar from storage and clears the profile reference', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: 'avatars/user-1.avif' });

		const result = await service.deleteAvatar(user);

		expect(storage.delete).toHaveBeenCalledWith('avatars/user-1.avif');
		expect(result.avatarUrl).toBeNull();
	});

	it('returns success without touching storage when no avatar exists', async () => {
		repository = createRepository(makeUserRecord({ avatarUrl: null }));
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: null });

		const result = await service.deleteAvatar(user);

		expect(storage.delete).not.toHaveBeenCalled();
		expect(result.avatarUrl).toBeNull();
	});
});
