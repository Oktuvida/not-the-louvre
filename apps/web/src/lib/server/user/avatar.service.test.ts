import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAvatarService } from './avatar.service';
import type { UserRecord, UserRepository } from './types';
import type { ArtworkStorage } from '$lib/server/artwork/types';
import type { CanonicalUser } from '$lib/server/auth/types';
import {
	createEmptyDrawingDocument,
	serializeCanonicalDrawingDocument,
	serializeDrawingDocument
} from '$lib/features/stroke-json/document';
import { decodeCompressedDrawingDocument } from '$lib/features/stroke-json/storage';

const makeUserRecord = (overrides: Partial<UserRecord> = {}): UserRecord => ({
	avatarDocument: null,
	avatarDocumentVersion: null,
	avatarIsHidden: false,
	avatarIsNsfw: false,
	avatarUrl: null,
	avatarOnboardingCompletedAt: null,
	banReason: null,
	bannedAt: null,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	id: 'user-1',
	isBanned: false,
	nickname: 'artist',
	role: 'user',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

const makeCanonicalUser = (overrides: Partial<CanonicalUser> = {}): CanonicalUser => ({
	avatarUrl: null,
	avatarOnboardingCompletedAt: null,
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
	...overrides,
	isBanned: overrides.isBanned ?? false
});

const createRepository = (initial: UserRecord | null = null): UserRepository => {
	let stored = initial;

	return {
		findUserById: vi.fn(async (id) => (stored?.id === id ? stored : null)),
		listUsers: vi.fn(async () => []),
		updateUserAvatar: vi.fn(async (id, input) => {
			if (!stored || stored.id !== id) return null;
			stored = { ...stored, ...input };
			return stored;
		}),
		updateAvatarModeration: vi.fn(async (id, input) => {
			if (!stored || stored.id !== id) return null;
			stored = { ...stored, ...input };
			return stored;
		}),
		updateBanState: vi.fn(async (id, input) => {
			if (!stored || stored.id !== id) return null;
			stored = { ...stored, ...input };
			return stored;
		}),
		updateUserAvatarUrl: vi.fn(async (id, avatarUrl, avatarOnboardingCompletedAt, updatedAt) => {
			if (!stored || stored.id !== id) return null;
			stored = { ...stored, avatarOnboardingCompletedAt, avatarUrl, updatedAt };
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
	const avatarDocument = serializeDrawingDocument(createEmptyDrawingDocument('avatar'));

	beforeEach(() => {
		repository = createRepository(makeUserRecord());
		storage = createStorage();
	});

	it('rejects unauthenticated requests', async () => {
		const service = createAvatarService({ repository, storage });

		await expect(service.uploadAvatar(null, avatarDocument)).rejects.toMatchObject({
			code: 'UNAUTHENTICATED',
			status: 401
		});
	});

	it('rejects soft-banned users before touching storage', async () => {
		const service = createAvatarService({ repository, storage });

		await expect(
			service.uploadAvatar(makeCanonicalUser({ isBanned: true }), avatarDocument)
		).rejects.toMatchObject({ code: 'BANNED_USER', status: 403 });

		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('rejects non-avatar drawing documents', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser();

		await expect(
			service.uploadAvatar(user, serializeDrawingDocument(createEmptyDrawingDocument('artwork')))
		).rejects.toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			status: 400
		});
	});

	it('stores the avatar and updates the user profile on valid upload', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1' });

		const result = await service.uploadAvatar(user, avatarDocument);

		expect(storage.upload).toHaveBeenCalledWith('avatars/user-1.avif', expect.any(File));
		expect(result.avatarDocument).toBeTruthy();
		expect(result.avatarDocumentVersion).toBe(2);
		expect(decodeCompressedDrawingDocument(result.avatarDocument!)).toBe(
			serializeCanonicalDrawingDocument(createEmptyDrawingDocument('avatar'))
		);
		expect(result.avatarUrl).toBe('avatars/user-1.avif');
	});

	it('overwrites the previous avatar key in place without a separate deletion', async () => {
		repository = createRepository(makeUserRecord({ avatarUrl: 'avatars/user-1.avif' }));
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: 'avatars/user-1.avif' });

		const result = await service.uploadAvatar(user, avatarDocument);

		expect(storage.upload).toHaveBeenCalledWith('avatars/user-1.avif', expect.any(File));
		expect(storage.delete).not.toHaveBeenCalled();
		expect(result.avatarUrl).toBe('avatars/user-1.avif');
	});

	it('does not call storage delete on first upload', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: null });

		await service.uploadAvatar(user, avatarDocument);

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

	it('rejects soft-banned users from deleting avatars', async () => {
		const service = createAvatarService({ repository, storage });

		await expect(
			service.deleteAvatar(makeCanonicalUser({ avatarUrl: 'avatars/user-1.avif', isBanned: true }))
		).rejects.toMatchObject({ code: 'BANNED_USER', status: 403 });
	});

	it('removes the avatar from storage and clears the profile reference', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: 'avatars/user-1.avif' });

		const result = await service.deleteAvatar(user);

		expect(storage.delete).toHaveBeenCalledWith('avatars/user-1.avif');
		expect(result.avatarDocument).toBeNull();
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
