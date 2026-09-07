import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAvatarService } from './avatar.service';
import type { UserRecord, UserRepository } from './types';
import type { ArtworkStorage } from '$lib/server/artwork/types';
import type { CanonicalUser } from '$lib/server/auth/types';
import {
	createEmptyDrawingDocument,
	countDrawingPoints,
	parseDrawingDocumentV2,
	serializeCanonicalDrawingDocument,
	serializeDrawingDocument
} from '$lib/features/stroke-json/document';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

// storage.ts is gone: gzip/base64 is the Rust runtime's job in production, so
// these suites unwrap the payload they gzipped themselves.
const gunzipBase64 = (payload: string) =>
	strFromU8(gunzipSync(new Uint8Array(Buffer.from(payload, 'base64'))));

const runtime = vi.hoisted(() => ({
	prepareDrawingDocumentForStorage: vi.fn()
}));

vi.mock('$lib/features/stroke-json/runtime.server', () => ({
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
		appendUserAvatarDocumentChunk: vi.fn(async (id, chunk, expectedLength, updatedAt) => {
			const current = readById(id);
			if (!current) return false;
			const existing = current.avatarDocument ?? '';
			if (existing.length !== expectedLength) return false;
			stored = { ...current, avatarDocument: existing + chunk, updatedAt };
			return true;
		}),
		finalizeUserAvatarDocument: vi.fn(async (id, version, expectedTotalLength, updatedAt) => {
			const current = readById(id);
			if (!current) return null;
			if ((current.avatarDocument ?? '').length !== expectedTotalLength) return null;
			stored = { ...current, avatarDocumentVersion: version, updatedAt };
			return { avatarDocumentVersion: version, id };
		}),
		findUserAvatarDocumentLength: vi.fn(async (id) => {
			const current = readById(id);
			return current ? (current.avatarDocument ?? '').length : null;
		}),
		findUserAvatarDocumentRef: vi.fn(async (id) => {
			const current = readById(id);
			return current ? { avatarDocumentVersion: current.avatarDocumentVersion ?? null, id } : null;
		}),
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
		updateUserAvatarUrl: vi.fn(async (id, avatarUrl, avatarOnboardingCompletedAt, updatedAt) => {
			const current = readById(id);
			if (!current) return null;
			const next = { ...current, avatarOnboardingCompletedAt, avatarUrl, updatedAt };
			stored = next;
			return asReturnedRecord(next);
		}),
		updateUserRole: vi.fn(async () => null)
	};

	return { read: () => stored, repository };
};

const createRepository = (initial: UserRecord | null = null): UserRepository =>
	createRepositoryStore(initial).repository;

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
			const compressedDocumentBase64 = Buffer.from(
				gzipSync(strToU8(canonicalDocumentJson))
			).toString('base64');

			return {
				canonicalDocumentJson,
				compressedDocumentBase64,
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
		const store = createRepositoryStore(makeUserRecord());
		const service = createAvatarService({ repository: store.repository, storage });
		const user = makeCanonicalUser({ id: 'user-1' });

		const result = await service.uploadAvatar(user, avatarDocument);

		expect(storage.upload).toHaveBeenCalledWith('avatars/user-1.avif', expect.any(File));
		expect(runtime.prepareDrawingDocumentForStorage).toHaveBeenCalledWith(avatarDocument);
		expect(result.avatarDocumentVersion).toBe(2);
		expect(gunzipBase64(store.read()!.avatarDocument!)).toBe(
			serializeCanonicalDrawingDocument(createEmptyDrawingDocument('avatar'))
		);
		expect(result.avatarUrl).toBe('avatars/user-1.avif');
	});

	it('writes the avatar document in chunks and never binds it whole', async () => {
		const store = createRepositoryStore(makeUserRecord());
		const service = createAvatarService({
			drawingDocumentChunkChars: 16,
			repository: store.repository,
			sleep: async () => {},
			storage
		});

		await service.uploadAvatar(makeCanonicalUser({ id: 'user-1' }), avatarDocument);

		const storedDocument = store.read()!.avatarDocument!;
		// Supavisor kills a session that receives the whole document in one Bind,
		// so the profile update must carry a null document and the chunks follow.
		expect(vi.mocked(store.repository.updateUserAvatar!).mock.calls[0]![1]).toMatchObject({
			avatarDocument: null,
			avatarDocumentVersion: null
		});
		expect(store.repository.appendUserAvatarDocumentChunk).toHaveBeenCalledTimes(
			Math.ceil(storedDocument.length / 16)
		);
		for (const call of vi.mocked(store.repository.appendUserAvatarDocumentChunk).mock.calls) {
			expect(call[1].length).toBeLessThanOrEqual(16);
		}
		expect(store.read()!.avatarDocumentVersion).toBe(2);
	});

	it('resumes chunk appends after a lost-ack append via the length read-back', async () => {
		const store = createRepositoryStore(makeUserRecord());
		const append = vi.mocked(store.repository.appendUserAvatarDocumentChunk);
		const applyChunk = append.getMockImplementation()!;
		append.mockImplementationOnce(async (id, chunk, expectedLength, updatedAt) => {
			// The append committed, but the socket died before the ack arrived.
			await applyChunk(id, chunk, expectedLength, updatedAt);
			throw Object.assign(new Error('write CONNECTION_CLOSED host:5432'), {
				code: 'CONNECTION_CLOSED'
			});
		});

		const service = createAvatarService({
			drawingDocumentChunkChars: 16,
			repository: store.repository,
			sleep: async () => {},
			storage
		});

		const result = await service.uploadAvatar(makeCanonicalUser({ id: 'user-1' }), avatarDocument);

		expect(result.avatarDocumentVersion).toBe(2);
		expect(gunzipBase64(store.read()!.avatarDocument!)).toBe(
			serializeCanonicalDrawingDocument(createEmptyDrawingDocument('avatar'))
		);
	});

	it('keeps the avatar saved and the document versionless when chunk writing fails', async () => {
		const store = createRepositoryStore(makeUserRecord());
		vi.mocked(store.repository.appendUserAvatarDocumentChunk).mockResolvedValue(false);

		const service = createAvatarService({
			drawingDocumentChunkChars: 16,
			repository: store.repository,
			sleep: async () => {},
			storage
		});

		const result = await service.uploadAvatar(makeCanonicalUser({ id: 'user-1' }), avatarDocument);

		// Onboarding must not fail on a document write: the avatar image is saved
		// and the versionless document is inert for readers.
		expect(result.avatarUrl).toBe('avatars/user-1.avif');
		expect(result.avatarDocumentVersion).toBeNull();
		expect(store.read()!.avatarDocumentVersion).toBeNull();
		expect(storage.delete).not.toHaveBeenCalled();
	});

	it('rejects artwork payloads before touching avatar storage', async () => {
		const service = createAvatarService({ repository, storage });
		const user = makeCanonicalUser();
		runtime.prepareDrawingDocumentForStorage.mockResolvedValueOnce({
			canonicalDocumentJson: serializeCanonicalDrawingDocument(
				createEmptyDrawingDocument('artwork')
			),
			compressedDocumentBase64: 'AA==',
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

	it('removes the avatar from storage and clears both document columns', async () => {
		const store = createRepositoryStore(
			makeUserRecord({
				avatarDocument: 'stale-document',
				avatarDocumentVersion: 2,
				avatarUrl: 'avatars/user-1.avif'
			})
		);
		const service = createAvatarService({ repository: store.repository, storage });
		const user = makeCanonicalUser({ id: 'user-1', avatarUrl: 'avatars/user-1.avif' });

		const result = await service.deleteAvatar(user);

		expect(storage.delete).toHaveBeenCalledWith('avatars/user-1.avif');
		// A versionless leftover must not survive: a later append would otherwise
		// resume on top of the old document.
		expect(store.read()!.avatarDocument).toBeNull();
		expect(store.read()!.avatarDocumentVersion).toBeNull();
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
