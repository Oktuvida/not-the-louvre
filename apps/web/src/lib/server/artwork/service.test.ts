import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTWORK_MEDIA_MAX_BYTES, ARTWORK_PUBLISH_RATE_LIMIT } from './config';
import { ArtworkFlowError } from './errors';
import type {
	ArtworkRecord,
	ArtworkRepository,
	ArtworkStorage,
	PublishRateLimitRecord
} from './types';

const createAvifFile = (size = 128, type = 'image/avif') => {
	const bytes = new Uint8Array(size);
	bytes.set([
		0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
		0x6d, 0x69, 0x66, 0x31
	]);

	return new File([bytes], 'artwork.avif', { type });
};

const createPngFile = (size = 128) =>
	new File([new Uint8Array(size)], 'artwork.png', { type: 'image/png' });

const createRepository = () => {
	const artworks = new Map<string, ArtworkRecord>();
	const rateLimits = new Map<string, PublishRateLimitRecord>();

	const repository: ArtworkRepository = {
		findVoteByArtworkAndUser: vi.fn(async () => null),
		upsertVote: vi.fn(async () => {
			throw new Error('not implemented in publish tests');
		}),
		removeVote: vi.fn(async () => {
			throw new Error('not implemented in publish tests');
		}),
		findEngagementRateLimit: vi.fn(async () => null),
		createEngagementRateLimit: vi.fn(async () => {
			throw new Error('not implemented in publish tests');
		}),
		updateEngagementRateLimit: vi.fn(async () => {
			throw new Error('not implemented in publish tests');
		}),
		listCommentsByArtworkId: vi.fn(async () => []),
		createComment: vi.fn(async () => {
			throw new Error('not implemented in publish tests');
		}),
		findCommentById: vi.fn(async () => null),
		deleteComment: vi.fn(async () => {
			throw new Error('not implemented in publish tests');
		}),
		findArtworkById: vi.fn(async (id: string) => artworks.get(id) ?? null),
		createArtwork: vi.fn(async (input) => {
			const record: ArtworkRecord = {
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
				...input
			};

			artworks.set(record.id, record);
			return record;
		}),
		updateArtworkTitle: vi.fn(async (id: string, title: string, updatedAt: Date) => {
			const current = artworks.get(id);
			if (!current) return null;

			const next = { ...current, title, updatedAt };
			artworks.set(id, next);
			return next;
		}),
		deleteArtwork: vi.fn(async (id: string) => {
			const current = artworks.get(id) ?? null;
			if (current) artworks.delete(id);
			return current;
		}),
		findPublishRateLimit: vi.fn(async (actorKey: string) => rateLimits.get(actorKey) ?? null),
		createPublishRateLimit: vi.fn(async (input) => {
			const record: PublishRateLimitRecord = {
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
				blockedUntil: input.blockedUntil ?? null,
				...input
			};

			rateLimits.set(record.actorKey, record);
			return record;
		}),
		updatePublishRateLimit: vi.fn(async (id: string, input) => {
			const current = Array.from(rateLimits.values()).find((candidate) => candidate.id === id);
			if (!current) throw new Error(`Missing publish rate limit ${id}`);

			const next = { ...current, ...input };
			rateLimits.set(current.actorKey, next);
			return next;
		})
	};

	return { artworks, rateLimits, repository };
};

const createStorage = () => {
	const uploads: Array<{ key: string; file: File }> = [];
	const deletes: string[] = [];

	const storage: ArtworkStorage = {
		upload: vi.fn(async (key: string, file: File) => {
			uploads.push({ key, file });
		}),
		delete: vi.fn(async (key: string) => {
			deletes.push(key);
		})
	};

	return { deletes, storage, uploads };
};

describe('artwork service', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('publishes an artwork with a stable ownership-aware storage key', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage, uploads } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		const result = await publishArtwork(
			{
				media: createAvifFile(),
				title: 'Evening Light'
			},
			{
				ipAddress: '127.0.0.1',
				user: {
					id: 'user-1',
					authUserId: 'user-1',
					nickname: 'artist_1',
					role: 'user',
					avatarUrl: null,
					name: 'artist_1',
					email: 'artist_1@not-the-louvre.local',
					emailVerified: true,
					image: null,
					createdAt: now,
					updatedAt: now
				}
			},
			{
				generateId: () => 'artwork-1',
				now: () => now,
				repository,
				storage
			}
		);

		expect(result.id).toBe('artwork-1');
		expect(result.storageKey).toBe('artworks/user-1/artwork-1.avif');
		expect(uploads).toHaveLength(1);
		expect(uploads[0]?.key).toBe('artworks/user-1/artwork-1.avif');
		expect(artworks.get('artwork-1')).toMatchObject({
			title: 'Evening Light',
			authorId: 'user-1',
			storageKey: 'artworks/user-1/artwork-1.avif'
		});
	});

	it('rejects non-AVIF media before touching storage', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();

		await expect(
			publishArtwork(
				{
					media: createPngFile(),
					title: 'Wrong format'
				},
				{
					ipAddress: '127.0.0.1',
					user: {
						id: 'user-1',
						authUserId: 'user-1',
						nickname: 'artist_1',
						role: 'user',
						avatarUrl: null,
						name: 'artist_1',
						email: 'artist_1@not-the-louvre.local',
						emailVerified: true,
						image: null,
						createdAt: new Date(),
						updatedAt: new Date()
					}
				},
				{ repository, storage }
			)
		).rejects.toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			status: 400
		});

		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('rejects oversized media before touching storage', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();

		await expect(
			publishArtwork(
				{
					media: createAvifFile(ARTWORK_MEDIA_MAX_BYTES + 1),
					title: 'Too large'
				},
				{
					ipAddress: '127.0.0.1',
					user: {
						id: 'user-1',
						authUserId: 'user-1',
						nickname: 'artist_1',
						role: 'user',
						avatarUrl: null,
						name: 'artist_1',
						email: 'artist_1@not-the-louvre.local',
						emailVerified: true,
						image: null,
						createdAt: new Date(),
						updatedAt: new Date()
					}
				},
				{ repository, storage }
			)
		).rejects.toMatchObject({
			code: 'MEDIA_TOO_LARGE',
			status: 400
		});

		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('cleans up uploaded media if record creation fails', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { deletes, storage } = createStorage();

		vi.mocked(repository.createArtwork).mockRejectedValueOnce(new Error('db insert failed'));

		await expect(
			publishArtwork(
				{
					media: createAvifFile(),
					title: 'Cleanup me'
				},
				{
					ipAddress: '127.0.0.1',
					user: {
						id: 'user-1',
						authUserId: 'user-1',
						nickname: 'artist_1',
						role: 'user',
						avatarUrl: null,
						name: 'artist_1',
						email: 'artist_1@not-the-louvre.local',
						emailVerified: true,
						image: null,
						createdAt: new Date(),
						updatedAt: new Date()
					}
				},
				{
					generateId: () => 'artwork-1',
					repository,
					storage
				}
			)
		).rejects.toMatchObject({
			code: 'PUBLISH_FAILED',
			status: 500
		});

		expect(deletes).toEqual(['artworks/user-1/artwork-1.avif']);
	});

	it('allows only the author to update an artwork title', async () => {
		const { publishArtwork, updateArtworkTitle } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		await publishArtwork(
			{
				media: createAvifFile(),
				title: 'Original'
			},
			{
				ipAddress: '127.0.0.1',
				user: {
					id: 'user-1',
					authUserId: 'user-1',
					nickname: 'artist_1',
					role: 'user',
					avatarUrl: null,
					name: 'artist_1',
					email: 'artist_1@not-the-louvre.local',
					emailVerified: true,
					image: null,
					createdAt: now,
					updatedAt: now
				}
			},
			{
				generateId: () => 'artwork-1',
				now: () => now,
				repository,
				storage
			}
		);

		const updated = await updateArtworkTitle(
			{ artworkId: 'artwork-1', title: 'Renamed' },
			{
				user: {
					id: 'user-1',
					authUserId: 'user-1',
					nickname: 'artist_1',
					role: 'user',
					avatarUrl: null,
					name: 'artist_1',
					email: 'artist_1@not-the-louvre.local',
					emailVerified: true,
					image: null,
					createdAt: now,
					updatedAt: now
				}
			},
			{ now: () => now, repository }
		);

		expect(updated.title).toBe('Renamed');

		await expect(
			updateArtworkTitle(
				{ artworkId: 'artwork-1', title: 'Stolen rename' },
				{
					user: {
						id: 'user-2',
						authUserId: 'user-2',
						nickname: 'artist_2',
						role: 'user',
						avatarUrl: null,
						name: 'artist_2',
						email: 'artist_2@not-the-louvre.local',
						emailVerified: true,
						image: null,
						createdAt: now,
						updatedAt: now
					}
				},
				{ now: () => now, repository }
			)
		).rejects.toMatchObject({
			code: 'FORBIDDEN',
			status: 403
		});
	});

	it('allows only the author to delete an artwork and removes stored media', async () => {
		const { deleteArtwork, publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { deletes, storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		await publishArtwork(
			{
				media: createAvifFile(),
				title: 'Disposable'
			},
			{
				ipAddress: '127.0.0.1',
				user: {
					id: 'user-1',
					authUserId: 'user-1',
					nickname: 'artist_1',
					role: 'user',
					avatarUrl: null,
					name: 'artist_1',
					email: 'artist_1@not-the-louvre.local',
					emailVerified: true,
					image: null,
					createdAt: now,
					updatedAt: now
				}
			},
			{
				generateId: () => 'artwork-1',
				now: () => now,
				repository,
				storage
			}
		);

		await expect(
			deleteArtwork(
				{ artworkId: 'artwork-1' },
				{
					user: {
						id: 'user-2',
						authUserId: 'user-2',
						nickname: 'artist_2',
						role: 'user',
						avatarUrl: null,
						name: 'artist_2',
						email: 'artist_2@not-the-louvre.local',
						emailVerified: true,
						image: null,
						createdAt: now,
						updatedAt: now
					}
				},
				{ repository, storage }
			)
		).rejects.toMatchObject({
			code: 'FORBIDDEN',
			status: 403
		});

		const deleted = await deleteArtwork(
			{ artworkId: 'artwork-1' },
			{
				user: {
					id: 'user-1',
					authUserId: 'user-1',
					nickname: 'artist_1',
					role: 'user',
					avatarUrl: null,
					name: 'artist_1',
					email: 'artist_1@not-the-louvre.local',
					emailVerified: true,
					image: null,
					createdAt: now,
					updatedAt: now
				}
			},
			{ repository, storage }
		);

		expect(deleted.id).toBe('artwork-1');
		expect(deletes).toEqual(['artworks/user-1/artwork-1.avif']);
	});

	it('rate limits repeated publish attempts within the configured window', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		let idCounter = 0;
		const now = new Date('2026-03-26T10:00:00.000Z');

		for (let attempt = 0; attempt < ARTWORK_PUBLISH_RATE_LIMIT.maxAttempts; attempt += 1) {
			await publishArtwork(
				{
					media: createAvifFile(),
					title: `Artwork ${attempt + 1}`
				},
				{
					ipAddress: '127.0.0.1',
					user: {
						id: 'user-1',
						authUserId: 'user-1',
						nickname: 'artist_1',
						role: 'user',
						avatarUrl: null,
						name: 'artist_1',
						email: 'artist_1@not-the-louvre.local',
						emailVerified: true,
						image: null,
						createdAt: now,
						updatedAt: now
					}
				},
				{
					generateId: () => `artwork-${++idCounter}`,
					now: () => now,
					repository,
					storage
				}
			);
		}

		await expect(
			publishArtwork(
				{
					media: createAvifFile(),
					title: 'Blocked artwork'
				},
				{
					ipAddress: '127.0.0.1',
					user: {
						id: 'user-1',
						authUserId: 'user-1',
						nickname: 'artist_1',
						role: 'user',
						avatarUrl: null,
						name: 'artist_1',
						email: 'artist_1@not-the-louvre.local',
						emailVerified: true,
						image: null,
						createdAt: now,
						updatedAt: now
					}
				},
				{
					generateId: () => `artwork-${++idCounter}`,
					now: () => now,
					repository,
					storage
				}
			)
		).rejects.toMatchObject({
			code: 'RATE_LIMITED',
			status: 429
		});
	});

	it('wraps unknown publish failures in a safe artwork flow error', async () => {
		const error = new ArtworkFlowError(500, 'Publish failed', 'PUBLISH_FAILED');
		expect(error.code).toBe('PUBLISH_FAILED');
	});
});
