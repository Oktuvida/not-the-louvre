import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAvatarService } from './avatar.service';
import type { UserRecord, UserRepository } from './types';
import type { ArtworkStorage } from '#lib/server/artwork/types.js';
import type { CanonicalUser } from '#lib/server/auth/types.js';
import {
	createEmptyDrawingDocument,
	countDrawingPoints,
	parseDrawingDocumentV2,
	serializeCanonicalDrawingDocument,
	serializeDrawingDocument
} from '#lib/features/stroke-json/document.js';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { createMemoryDrawingDocumentStore } from '#lib/server/drawing-document/memory-document-store.js';

// prepareDrawingDocumentForStorage is mocked, so the suite unwraps the gzip it
// produced itself.
const gunzip = (payload: Uint8Array) => strFromU8(gunzipSync(payload));

let documents = createMemoryDrawingDocumentStore();
beforeEach(() => {
	documents = createMemoryDrawingDocumentStore();
});

const runtime = vi.hoisted(() => ({
	prepareDrawingDocumentForStorage: vi.fn()
}));

vi.mock('#lib/server/drawing-document/storage.js', () => ({
	prepareDrawingDocumentForStorage: runtime.prepareDrawingDocumentForStorage
}));

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

// Mirrors the repository's RETURNING projection: no update hands the avatar
// drawing document back over the pooler.
const asReturnedRecord = (record: UserRecord): UserRecord => {
	const returned = { ...record };
	delete returned.avatarDocument;
	delete returned.avatarDocumentVersion;
	return returned;
};

const createRepositoryStore = (initial: UserRecord | null = null) => {
	let stored = initial;

	const readById = (id: string) => {
		const current = stored;
		return current && current.id === id ? current : null;
	};

	const repository: UserRepository = {
		findUserAvatarRefById: vi.fn(async (id) => {
			const current = readById(id);
			return current
				? {
						avatarIsHidden: current.avatarIsHidden,
						avatarIsNsfw: current.avatarIsNsfw,
						avatarUrl: current.avatarUrl,
						createdAt: current.createdAt,
						id: current.id,
						nickname: current.nickname,
						role: current.role,
						updatedAt: current.updatedAt
					}
				: null;
		}),
		findUserById: vi.fn(async (id) => readById(id)),
		listUsers: vi.fn(async () => []),
		updateUserAvatar: vi.fn(async (id, input) => {
			const current = readById(id);
			if (!current) return null;
			const next = { ...current, ...input };
			stored = next;
			return asReturnedRecord(next);
		}),
		updateAvatarModeration: vi.fn(async (id, input) => {
			const current = readById(id);
			if (!current) return null;
			const next = { ...current, ...input };
			stored = next;
			return asReturnedRecord(next);
		}),
		updateBanState: vi.fn(async (id, input) => {
			const current = readById(id);
			if (!current) return null;
			const next = { ...current, ...input };
			stored = next;
			return asReturnedRecord(next);
		}),
		updateUserRole: vi.fn(async () => null)
	};

	return { read: () => stored, repository };
};

const createRepository = (initial: UserRecord | null = null): UserRepository =>
	createRepositoryStore(initial).repository;

const VERSIONED_AVATAR_KEY = /^avatars\/user-1\/[0-9a-f]{16}\.webp$/;

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
		runtime.prepareDrawingDocumentForStorage.mockReset();
		runtime.prepareDrawingDocumentForStorage.mockImplementation(async (documentJson: string) => {
			const document = parseDrawingDocumentV2(documentJson);
			const canonicalDocumentJson = serializeCanonicalDrawingDocument(document);
			const compressed = new Uint8Array(gzipSync(strToU8(canonicalDocumentJson)));

			return {
				canonicalDocumentJson,
				compressed,
				document,
				height: document.height,
				kind: document.kind,
				strokeCount: document.base.length + document.tail.length,
				totalPoints: countDrawingPoints(document),
				version: document.version,
				width: document.width
			};
		});
	});

	it('rejects unauthenticated requests', async () => {
		const service = createAvatarService({ documents: documents.store, repository, storage });

		await expect(service.uploadAvatar(null, avatarDocument)).rejects.toMatchObject({
			code: 'UNAUTHENTICATED',
			status: 401
		});
	});

	it('rejects soft-banned users before touching storage', async () => {
		const service = createAvatarService({ documents: documents.store, repository, storage });

		await expect(
			service.uploadAvatar(makeCanonicalUser({ isBanned: true }), avatarDocument)
		).rejects.toMatchObject({ code: 'BANNED_USER', status: 403 });

		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('rejects non-avatar drawing documents', async () => {
		const service = createAvatarService({ documents: documents.store, repository, storage });
		const user = makeCanonicalUser();

		await expect(
			service.uploadAvatar(user, serializeDrawingDocument(createEmptyDrawingDocument('artwork')))
		).rejects.toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			status: 400
		});
	});

	it('stores the avatar and updates the user profile on valid upload', async () => {
		const store = createRepositoryStore(makeUserRecord());
		const service = createAvatarService({
			documents: documents.store,
			repository: store.repository,
			storage
		});
		const user = makeCanonicalUser({ id: 'user-1' });

		const result = await service.uploadAvatar(user, avatarDocument);

		expect(result.avatarUrl).toMatch(VERSIONED_AVATAR_KEY);
		expect(storage.upload).toHaveBeenCalledWith(result.avatarUrl, expect.any(File));
		expect(runtime.prepareDrawingDocumentForStorage).toHaveBeenCalledWith(avatarDocument);
		expect(store.read()!.avatarDocumentVersion).toBe(2);
		const documentKey = store.read()!.avatarDocumentKey!;
		expect(gunzip(documents.objects.get(documentKey)!)).toBe(
			serializeCanonicalDrawingDocument(createEmptyDrawingDocument('avatar'))
		);
	});

	it('keeps the previous avatar when the drawing cannot be stored', async () => {
		const store = createRepositoryStore(makeUserRecord({ avatarUrl: 'avatars/user-1.avif' }));
		const service = createAvatarService({
			documents: {
				put: async () => {
					throw new Error('bucket unavailable');
				},
				read: documents.store.read
			},
			repository: store.repository,
			storage
		});

		await expect(
			service.uploadAvatar(
				makeCanonicalUser({ id: 'user-1', avatarUrl: 'avatars/user-1.avif' }),
				avatarDocument
			)
		).rejects.toThrow();

		expect(storage.upload).not.toHaveBeenCalled();
		expect(store.read()!.avatarUrl).toBe('avatars/user-1.avif');
	});

	it('rejects artwork payloads before touching avatar storage', async () => {
		const service = createAvatarService({ documents: documents.store, repository, storage });
		const user = makeCanonicalUser();
		runtime.prepareDrawingDocumentForStorage.mockResolvedValueOnce({
			canonicalDocumentJson: serializeCanonicalDrawingDocument(
				createEmptyDrawingDocument('artwork')
			),
			compressed: new Uint8Array([0]),
			document: parseDrawingDocumentV2(
				serializeCanonicalDrawingDocument(createEmptyDrawingDocument('artwork'))
			),
			height: 768,
			kind: 'artwork',
			strokeCount: 0,
			totalPoints: 0,
			version: 2,
			width: 768
		});

		await expect(service.uploadAvatar(user, avatarDocument)).rejects.toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			status: 400
		});
		expect(storage.upload).not.toHaveBeenCalled();
	});

	// The address changes with the picture, so every cache can keep an avatar
	// forever and nobody is ever shown the previous one.
	it('gives a changed avatar a new address and removes the old image', async () => {
		repository = createRepository(makeUserRecord({ avatarUrl: 'avatars/user-1.avif' }));
		const service = createAvatarService({ documents: documents.store, repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: 'avatars/user-1.avif' });

		const result = await service.uploadAvatar(user, avatarDocument);

		expect(result.avatarUrl).toMatch(VERSIONED_AVATAR_KEY);
		expect(storage.delete).toHaveBeenCalledWith('avatars/user-1.avif');
	});

	it('keeps the same address when the same drawing is saved again', async () => {
		const store = createRepositoryStore(makeUserRecord());
		const service = createAvatarService({
			documents: documents.store,
			repository: store.repository,
			storage
		});

		const first = await service.uploadAvatar(makeCanonicalUser({ id: 'user-1' }), avatarDocument);
		const second = await service.uploadAvatar(
			makeCanonicalUser({ id: 'user-1', avatarUrl: first.avatarUrl }),
			avatarDocument
		);

		expect(second.avatarUrl).toBe(first.avatarUrl);
		expect(storage.delete).not.toHaveBeenCalled();
	});

	it('does not call storage delete on first upload', async () => {
		const service = createAvatarService({ documents: documents.store, repository, storage });
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
		const service = createAvatarService({ documents: documents.store, repository, storage });

		await expect(service.deleteAvatar(null)).rejects.toMatchObject({
			code: 'UNAUTHENTICATED',
			status: 401
		});
	});

	it('rejects soft-banned users from deleting avatars', async () => {
		const service = createAvatarService({ documents: documents.store, repository, storage });

		await expect(
			service.deleteAvatar(makeCanonicalUser({ avatarUrl: 'avatars/user-1.avif', isBanned: true }))
		).rejects.toMatchObject({ code: 'BANNED_USER', status: 403 });
	});

	it('removes the avatar from storage and forgets its drawing', async () => {
		const store = createRepositoryStore(
			makeUserRecord({
				avatarDocument: 'stale-document',
				avatarDocumentVersion: 2,
				avatarUrl: 'avatars/user-1.avif'
			})
		);
		const service = createAvatarService({
			documents: documents.store,
			repository: store.repository,
			storage
		});
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: 'avatars/user-1.avif' });

		const result = await service.deleteAvatar(user);

		expect(storage.delete).toHaveBeenCalledWith('avatars/user-1.avif');
		expect(store.read()!.avatarDocument).toBeNull();
		expect(store.read()!.avatarDocumentKey).toBeNull();
		expect(store.read()!.avatarDocumentVersion).toBeNull();
		expect(result.avatarUrl).toBeNull();
	});

	it('returns success without touching storage when no avatar exists', async () => {
		repository = createRepository(makeUserRecord({ avatarUrl: null }));
		const service = createAvatarService({ documents: documents.store, repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: null });

		const result = await service.deleteAvatar(user);

		expect(storage.delete).not.toHaveBeenCalled();
		expect(result.avatarUrl).toBeNull();
	});
});
