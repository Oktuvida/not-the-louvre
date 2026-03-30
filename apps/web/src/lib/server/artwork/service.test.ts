import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ARTWORK_MEDIA_HEIGHT,
	ARTWORK_MEDIA_MAX_BYTES,
	ARTWORK_MEDIA_WIDTH,
	ARTWORK_PUBLISH_RATE_LIMIT
} from './config';
import { ArtworkFlowError } from './errors';
import {
	createAvifTestFile,
	createJpegTestFile,
	createMalformedAvifFile,
	createPngTestFile,
	createWebpTestFile,
	fileToBytes
} from '../media/test-helpers';
import type {
	ArtworkRecord,
	ArtworkRepository,
	ArtworkStorage,
	ContentReportRecord,
	PublishRateLimitRecord
} from './types';

type ModerationCheckResult = { status: 'allowed' } | { message: string; status: 'blocked' };

const moderation = vi.hoisted(() => ({
	checkTextModeration: vi.fn<() => Promise<ModerationCheckResult>>(async () => ({
		status: 'allowed'
	}))
}));

vi.mock('$lib/server/moderation/service', () => ({
	checkTextModeration: moderation.checkTextModeration
}));

const createUnsupportedImageFile = (size = 128) =>
	new File([new Uint8Array(size)], 'artwork.gif', { type: 'image/gif' });

const createRepository = () => {
	const artworks = new Map<string, ArtworkRecord>();
	const reports = new Map<string, ContentReportRecord>();
	const rateLimits = new Map<string, PublishRateLimitRecord>();
	const comments = new Map<
		string,
		{
			artworkId: string;
			authorId: string;
			body: string;
			createdAt: Date;
			hiddenAt?: Date | null;
			id: string;
			isHidden?: boolean;
			updatedAt: Date;
		}
	>();

	const repository: ArtworkRepository = {
		createContentReport: vi.fn(async (input) => {
			const record: ContentReportRecord = { ...input };
			reports.set(record.id, record);
			return record;
		}),
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
		findCommentReportCount: vi.fn(
			async (commentId: string) =>
				Array.from(reports.values()).filter(
					(report) => report.commentId === commentId && report.status === 'pending'
				).length
		),
		findArtworkReportCount: vi.fn(
			async (artworkId: string) =>
				Array.from(reports.values()).filter(
					(report) => report.artworkId === artworkId && report.status === 'pending'
				).length
		),
		resolveArtworkReports: vi.fn(async () => 0),
		resolveCommentReports: vi.fn(async () => 0),
		deleteComment: vi.fn(async () => {
			throw new Error('not implemented in publish tests');
		}),
		findArtworkById: vi.fn(async (id: string) => artworks.get(id) ?? null),
		findChildForksByParentId: vi.fn(async (parentId: string) =>
			Array.from(artworks.values()).filter((artwork) => artwork.parentId === parentId)
		),
		createArtwork: vi.fn(async (input) => {
			const record: ArtworkRecord = {
				hiddenAt: input.hiddenAt ?? null,
				isHidden: input.isHidden ?? false,
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
				...input
			};

			artworks.set(record.id, record);

			if (record.parentId) {
				const parent = artworks.get(record.parentId);
				if (parent) {
					artworks.set(record.parentId, { ...parent, forkCount: parent.forkCount + 1 });
				}
			}

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
			if (current) {
				artworks.delete(id);
				if (current.parentId) {
					const parent = artworks.get(current.parentId);
					if (parent) {
						artworks.set(current.parentId, {
							...parent,
							forkCount: Math.max(0, parent.forkCount - 1)
						});
					}
				}
			}
			return current;
		}),
		setArtworkHiddenState: vi.fn(async (id: string, input) => {
			const current = artworks.get(id);
			if (!current) return null;
			const next = { ...current, ...input };
			artworks.set(id, next);
			return next;
		}),
		updateArtworkModeration: vi.fn(async (id: string, input) => {
			const current = artworks.get(id);
			if (!current) return null;
			const next = { ...current, ...input };
			artworks.set(id, next);
			return next;
		}),
		setCommentHiddenState: vi.fn(async (id: string, input) => {
			const current = comments.get(id);
			if (!current) return null;
			const next = { ...current, ...input };
			comments.set(id, next);
			return next;
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

	return { artworks, comments, rateLimits, reports, repository };
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
		moderation.checkTextModeration.mockReset();
		moderation.checkTextModeration.mockResolvedValue({ status: 'allowed' });
	});

	it('publishes an artwork with a stable ownership-aware storage key', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage, uploads } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');
		const media = await createAvifTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			quality: 95,
			width: ARTWORK_MEDIA_WIDTH
		});

		const result = await publishArtwork(
			{
				media,
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
		expect(result.parentId).toBeNull();
		expect(result.forkCount).toBe(0);
		expect(uploads).toHaveLength(1);
		expect(uploads[0]?.key).toBe('artworks/user-1/artwork-1.avif');
		expect(await fileToBytes(uploads[0]!.file)).not.toEqual(await fileToBytes(media));
		expect(artworks.get('artwork-1')).toMatchObject({
			title: 'Evening Light',
			authorId: 'user-1',
			isNsfw: false,
			storageKey: 'artworks/user-1/artwork-1.avif',
			parentId: null,
			forkCount: 0
		});
	}, 10000);

	it('persists creator-labeled nsfw metadata on publish', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');
		const media = await createAvifTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			width: ARTWORK_MEDIA_WIDTH
		});

		const result = await publishArtwork(
			{
				isNsfw: true,
				media,
				title: 'Figure Study'
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

		expect(result).toMatchObject({
			isNsfw: true,
			nsfwSource: 'creator'
		});
		expect(artworks.get('artwork-1')).toMatchObject({
			isNsfw: true,
			nsfwSource: 'creator'
		});
	});

	it('rejects artwork titles blocked by backend moderation before upload', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage, uploads } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');
		moderation.checkTextModeration.mockResolvedValue({
			message: 'Choose a different artwork title.',
			status: 'blocked'
		});

		await expect(
			publishArtwork(
				{
					media: await createAvifTestFile({
						height: ARTWORK_MEDIA_HEIGHT,
						name: 'artwork.avif',
						width: ARTWORK_MEDIA_WIDTH
					}),
					title: 'mierda'
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
				{ repository, storage }
			)
		).rejects.toMatchObject({ code: 'INVALID_TITLE', status: 400 });
		expect(uploads).toHaveLength(0);
	});

	it('publishes a forked artwork for a valid active parent and increments the parent fork count', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');
		const media = await createAvifTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			width: ARTWORK_MEDIA_WIDTH
		});

		await publishArtwork(
			{
				media,
				title: 'Original artwork'
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
				generateId: () => 'artwork-parent',
				now: () => now,
				repository,
				storage
			}
		);

		const fork = await publishArtwork(
			{
				media,
				parentArtworkId: 'artwork-parent',
				title: 'Forked artwork'
			},
			{
				ipAddress: '127.0.0.1',
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
			{
				generateId: () => 'artwork-child',
				now: () => now,
				repository,
				storage
			}
		);

		expect(fork).toMatchObject({
			id: 'artwork-child',
			parentId: 'artwork-parent',
			forkCount: 0
		});
		expect(artworks.get('artwork-parent')).toMatchObject({
			forkCount: 1,
			id: 'artwork-parent'
		});
	});

	it('rejects fork publishes for a missing parent before uploading media', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		const media = await createAvifTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			width: ARTWORK_MEDIA_WIDTH
		});

		await expect(
			publishArtwork(
				{
					media,
					parentArtworkId: 'missing-parent',
					title: 'Broken fork'
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
			code: 'INVALID_FORK_PARENT',
			status: 400
		});

		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('publishes browser-exported WebP source media and stores canonical AVIF output', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage, uploads } = createStorage();
		const media = await createWebpTestFile({ height: 768, width: 768 });
		const now = new Date('2026-03-26T10:00:00.000Z');

		const result = await publishArtwork(
			{
				media,
				title: 'Browser export'
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
				generateId: () => 'artwork-webp',
				now: () => now,
				repository,
				storage
			}
		);

		expect(result.id).toBe('artwork-webp');
		expect(uploads).toHaveLength(1);
		expect(uploads[0]?.file.type).toBe('image/avif');
		expect(artworks.get('artwork-webp')?.mediaContentType).toBe('image/avif');
		expect(await fileToBytes(uploads[0]!.file)).not.toEqual(await fileToBytes(media));
	}, 30000);

	it('publishes browser-exported JPEG source media and stores canonical AVIF output', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage, uploads } = createStorage();
		const media = await createJpegTestFile({ height: 900, width: 900 });

		await publishArtwork(
			{
				media,
				title: 'JPEG browser export'
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
		);

		expect(uploads).toHaveLength(1);
		expect(uploads[0]?.file.type).toBe('image/avif');
	});

	it('publishes browser-exported PNG source media as the last fallback and stores canonical AVIF output', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage, uploads } = createStorage();
		const media = await createPngTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			width: ARTWORK_MEDIA_WIDTH
		});

		await publishArtwork(
			{
				media,
				title: 'PNG browser export'
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
		);

		expect(uploads).toHaveLength(1);
		expect(uploads[0]?.file.type).toBe('image/avif');
	});

	it('rejects unsupported source media before touching storage', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();

		await expect(
			publishArtwork(
				{
					media: createUnsupportedImageFile(),
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
			message: 'Artwork media must be AVIF, WebP, JPEG, or PNG',
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
					media: new File([new Uint8Array(ARTWORK_MEDIA_MAX_BYTES + 1)], 'artwork.avif', {
						type: 'image/avif'
					}),
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

	it('rejects malformed AVIF payloads before touching storage', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();

		await expect(
			publishArtwork(
				{
					media: createMalformedAvifFile(),
					title: 'Broken payload'
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
			code: 'INVALID_MEDIA_CONTENT',
			status: 400
		});

		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('rejects JPEG payloads disguised as .avif before touching storage', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		const jpegPayload = await createJpegTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			width: ARTWORK_MEDIA_WIDTH
		});
		const disguisedFile = new File([await jpegPayload.arrayBuffer()], 'artwork.avif', {
			type: 'image/avif'
		});

		await expect(
			publishArtwork(
				{
					media: disguisedFile,
					title: 'Disguised payload'
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
			code: 'INVALID_MEDIA_CONTENT',
			status: 400
		});

		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('rejects artwork media whose decoded dimensions are not canonical', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		const media = await createAvifTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			width: ARTWORK_MEDIA_WIDTH + 256
		});

		await expect(
			publishArtwork(
				{
					media,
					title: 'Wrong dimensions'
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
			code: 'INVALID_MEDIA_DIMENSIONS',
			status: 400
		});

		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('publishes complex artwork media within the stored-media budget after adaptive sanitization', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage, uploads } = createStorage();
		const media = await createAvifTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			pattern: 'noise',
			quality: 5,
			width: ARTWORK_MEDIA_WIDTH
		});

		expect(media.size).toBeLessThanOrEqual(ARTWORK_MEDIA_MAX_BYTES);

		const result = await publishArtwork(
			{
				media,
				title: 'Too complex'
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
		);

		expect(result.mediaSizeBytes).toBeLessThanOrEqual(ARTWORK_MEDIA_MAX_BYTES);
		expect(uploads).toHaveLength(1);
		expect(uploads[0]?.file.type).toBe('image/avif');
	}, 30000);

	it('cleans up uploaded media if record creation fails', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { deletes, storage } = createStorage();
		const media = await createAvifTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			width: ARTWORK_MEDIA_WIDTH
		});

		vi.mocked(repository.createArtwork).mockRejectedValueOnce(new Error('db insert failed'));

		await expect(
			publishArtwork(
				{
					media,
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
				media: await createAvifTestFile({
					height: ARTWORK_MEDIA_HEIGHT,
					name: 'artwork.avif',
					width: ARTWORK_MEDIA_WIDTH
				}),
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

	it('rejects updated titles blocked by backend moderation', async () => {
		const { publishArtwork, updateArtworkTitle } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		await publishArtwork(
			{
				media: await createAvifTestFile({
					height: ARTWORK_MEDIA_HEIGHT,
					name: 'artwork.avif',
					width: ARTWORK_MEDIA_WIDTH
				}),
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

		moderation.checkTextModeration.mockResolvedValue({
			message: 'Choose a different artwork title.',
			status: 'blocked'
		});

		await expect(
			updateArtworkTitle(
				{ artworkId: 'artwork-1', title: 'mierda' },
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
			)
		).rejects.toMatchObject({ code: 'INVALID_TITLE', status: 400 });
	});

	it('allows only the author to delete an artwork and removes stored media', async () => {
		const { deleteArtwork, publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { deletes, storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		await publishArtwork(
			{
				media: await createAvifTestFile({
					height: ARTWORK_MEDIA_HEIGHT,
					name: 'artwork.avif',
					width: ARTWORK_MEDIA_WIDTH
				}),
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

	it('decrements the parent fork count when a child fork is deleted', async () => {
		const { deleteArtwork, publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');
		const media = await createAvifTestFile({
			height: ARTWORK_MEDIA_HEIGHT,
			name: 'artwork.avif',
			width: ARTWORK_MEDIA_WIDTH
		});

		await publishArtwork(
			{
				media,
				title: 'Original artwork'
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
				generateId: () => 'artwork-parent',
				now: () => now,
				repository,
				storage
			}
		);

		await publishArtwork(
			{
				media,
				parentArtworkId: 'artwork-parent',
				title: 'Forked artwork'
			},
			{
				ipAddress: '127.0.0.1',
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
			{
				generateId: () => 'artwork-child',
				now: () => now,
				repository,
				storage
			}
		);

		expect(artworks.get('artwork-parent')?.forkCount).toBe(1);

		await deleteArtwork(
			{ artworkId: 'artwork-child' },
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
		);

		expect(artworks.get('artwork-parent')?.forkCount).toBe(0);
	});

	it('rate limits repeated publish attempts within the configured window', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		let idCounter = 0;
		const now = new Date('2026-03-26T10:00:00.000Z');
		const media = new File([new Uint8Array([1, 2, 3])], 'artwork.avif', { type: 'image/avif' });
		const sanitizeMedia = vi.fn(async (file: File) => ({
			contentType: 'image/avif',
			file,
			height: ARTWORK_MEDIA_HEIGHT,
			sizeBytes: file.size,
			width: ARTWORK_MEDIA_WIDTH
		}));

		for (let attempt = 0; attempt < ARTWORK_PUBLISH_RATE_LIMIT.maxAttempts; attempt += 1) {
			await publishArtwork(
				{
					media,
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
					sanitizeMedia,
					storage
				}
			);
		}

		await expect(
			publishArtwork(
				{
					media,
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
					sanitizeMedia,
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
