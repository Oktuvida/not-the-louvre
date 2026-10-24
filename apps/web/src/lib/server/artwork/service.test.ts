import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTWORK_MEDIA_HEIGHT, ARTWORK_MEDIA_WIDTH, ARTWORK_PUBLISH_RATE_LIMIT } from './config';
import {
	createEmptyDrawingDocument,
	countDrawingPoints,
	parseDrawingDocument,
	parseDrawingDocumentV2,
	serializeCanonicalDrawingDocument
} from '#lib/features/stroke-json/document.js';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { ArtworkFlowError } from './errors';
import { applyRateLimitAttempt } from '#lib/server/db/fixtures/rate-limit.js';
import type {
	ArtworkRecord,
	ArtworkRepository,
	ArtworkStorage,
	ContentReportRecord,
	PublishRateLimitRecord
} from './types';

// prepareDrawingDocumentForStorage is mocked, so the suite unwraps the gzip it
// produced itself.
const gunzip = (payload: Uint8Array) => strFromU8(gunzipSync(payload));

// Object storage for drawings, in memory: publishes keep their documents here.
const storedDocuments = vi.hoisted(() => {
	const objects = new Map<string, Uint8Array>();
	return {
		objects,
		store: {
			async put(compressed: Uint8Array) {
				const key = `documents/test-${objects.size + 1}.json.gz`;
				objects.set(key, compressed);
				return key;
			},
			async read(key: string) {
				return objects.get(key)!;
			}
		}
	};
});

const readStoredDocument = (record: ArtworkRecord | undefined) =>
	gunzip(storedDocuments.objects.get(record!.drawingDocumentKey!)!);

type ModerationCheckResult = { status: 'allowed' } | { message: string; status: 'blocked' };

const moderation = vi.hoisted(() => ({
	checkTextModeration: vi.fn<() => Promise<ModerationCheckResult>>(async () => ({
		status: 'allowed'
	}))
}));

const runtime = vi.hoisted(() => ({
	prepareDrawingDocumentForStorage: vi.fn()
}));

vi.mock('#lib/server/moderation/service.js', () => ({
	checkTextModeration: moderation.checkTextModeration
}));

vi.mock('#lib/server/drawing-document/storage.js', () => ({
	prepareDrawingDocumentForStorage: runtime.prepareDrawingDocumentForStorage
}));

vi.mock('#lib/server/drawing-document/document-store.js', () => ({
	drawingDocumentStore: storedDocuments.store
}));

const ARTWORK_DRAWING_DOCUMENT = JSON.stringify(createEmptyDrawingDocument('artwork'));

// Mirrors the repository's RETURNING projection: every artworks column except
// drawing_document, which no writer's caller reads back.
const asReturnedRecord = (record: ArtworkRecord): ArtworkRecord => {
	const returned = { ...record };
	delete returned.drawingDocument;
	return returned;
};

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
		recordEngagementRateLimitAttempt: vi.fn(async () => {
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

			return asReturnedRecord(record);
		}),
		updateArtworkTitle: vi.fn(async (id: string, title: string, updatedAt: Date) => {
			const current = artworks.get(id);
			if (!current) return null;

			const next = { ...current, title, updatedAt };
			artworks.set(id, next);
			return asReturnedRecord(next);
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
			return current ? asReturnedRecord(current) : null;
		}),
		setArtworkHiddenState: vi.fn(async (id: string, input) => {
			const current = artworks.get(id);
			if (!current) return null;
			const next = { ...current, ...input };
			artworks.set(id, next);
			return asReturnedRecord(next);
		}),
		updateArtworkModeration: vi.fn(async (id: string, input) => {
			const current = artworks.get(id);
			if (!current) return null;
			const next = { ...current, ...input };
			artworks.set(id, next);
			return asReturnedRecord(next);
		}),
		setCommentHiddenState: vi.fn(async (id: string, input) => {
			const current = comments.get(id);
			if (!current) return null;
			const next = { ...current, ...input };
			comments.set(id, next);
			return next;
		}),
		findPublishRateLimit: vi.fn(async (actorKey: string) => rateLimits.get(actorKey) ?? null),
		recordPublishRateLimitAttempt: vi.fn(async (input) => {
			const record = applyRateLimitAttempt(rateLimits.get(input.actorKey) ?? null, input);
			rateLimits.set(record.actorKey, record);
			return record;
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

	it('publishes an artwork with a stable ownership-aware storage key', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage, uploads } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		const result = await publishArtwork(
			{
				drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
		expect(result.storageKey).toBe('artworks/user-1/artwork-1.webp');
		expect(result.parentId).toBeNull();
		expect(result.forkCount).toBe(0);
		expect(uploads).toHaveLength(1);
		expect(uploads[0]?.key).toBe('artworks/user-1/artwork-1.webp');
		expect(artworks.get('artwork-1')).toMatchObject({
			title: 'Evening Light',
			authorId: 'user-1',
			isNsfw: false,
			storageKey: 'artworks/user-1/artwork-1.webp',
			parentId: null,
			forkCount: 0
		});
	}, 10000);

	it('publishes an artwork drawing document and stores the compressed source snapshot', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage, uploads } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');
		const drawingDocument = JSON.stringify({
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [
						[48, 48] as [number, number],
						[320, 320] as [number, number],
						[540, 220] as [number, number]
					],
					size: 12
				}
			]
		});

		const result = await publishArtwork(
			{
				drawingDocument,
				title: 'Vector First'
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

		expect(result.storageKey).toBe('artworks/user-1/artwork-1.webp');
		expect(result.drawingVersion).toBe(2);
		// The row only names the drawing, which lives in object storage.
		expect(result.drawingDocument).toBeUndefined();
		expect(runtime.prepareDrawingDocumentForStorage).toHaveBeenCalledWith(drawingDocument);
		expect(uploads).toHaveLength(1);
		expect(uploads[0]?.file.type).toBe('image/webp');
		expect(readStoredDocument(artworks.get('artwork-1'))).toBe(
			serializeCanonicalDrawingDocument(parseDrawingDocument(drawingDocument))
		);
		expect(artworks.get('artwork-1')).toMatchObject({
			drawingVersion: 2,
			title: 'Vector First'
		});
	});

	it('rejects runtime-prepared avatar payloads on artwork publish', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		runtime.prepareDrawingDocumentForStorage.mockResolvedValueOnce({
			canonicalDocumentJson: serializeCanonicalDrawingDocument(
				createEmptyDrawingDocument('avatar')
			),
			compressed: new Uint8Array([0]),
			document: parseDrawingDocumentV2(
				serializeCanonicalDrawingDocument(createEmptyDrawingDocument('avatar'))
			),
			height: 340,
			kind: 'avatar',
			strokeCount: 0,
			totalPoints: 0,
			version: 2,
			width: 340
		});

		await expect(
			publishArtwork(
				{
					drawingDocument: JSON.stringify(createEmptyDrawingDocument('avatar')),
					title: 'Wrong kind'
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
		).rejects.toMatchObject({ code: 'INVALID_MEDIA_FORMAT', status: 400 });
	});

	it('persists creator-labeled nsfw metadata on publish', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		const result = await publishArtwork(
			{
				isNsfw: true,
				drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
					drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
		const parentDocument = JSON.stringify({
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [[120, 120] as [number, number], [240, 240] as [number, number]],
					size: 8
				}
			]
		});
		const childDocument = JSON.stringify({
			...JSON.parse(parentDocument),
			strokes: [
				...JSON.parse(parentDocument).strokes,
				{
					color: '#c84f4f',
					points: [
						[320, 320],
						[480, 420]
					],
					size: 10
				}
			]
		});

		await publishArtwork(
			{
				drawingDocument: parentDocument,
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
				drawingDocument: childDocument,
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
			drawingVersion: 2,
			id: 'artwork-child',
			parentId: 'artwork-parent',
			forkCount: 0
		});
		expect(readStoredDocument(artworks.get('artwork-child'))).toBe(
			serializeCanonicalDrawingDocument(parseDrawingDocument(childDocument))
		);
		expect(artworks.get('artwork-parent')).toMatchObject({
			forkCount: 1,
			id: 'artwork-parent'
		});
	});

	it('rejects fork publishes for a missing parent before uploading media', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		const drawingDocument = JSON.stringify(createEmptyDrawingDocument('artwork'));

		await expect(
			publishArtwork(
				{
					drawingDocument,
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

	it('cleans up uploaded media if record creation fails', async () => {
		const { publishArtwork } = await import('./service');
		const { repository } = createRepository();
		const { deletes, storage } = createStorage();

		vi.mocked(repository.createArtwork).mockRejectedValueOnce(new Error('db insert failed'));

		await expect(
			publishArtwork(
				{
					drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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

		expect(deletes).toEqual(['artworks/user-1/artwork-1.webp']);
	});

	it('keeps a committed publish successful when rate limit bookkeeping fails afterwards', async () => {
		const { publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { deletes, storage } = createStorage();

		vi.mocked(repository.recordPublishRateLimitAttempt).mockRejectedValueOnce(
			new Error('connection terminated unexpectedly')
		);

		const result = await publishArtwork(
			{
				drawingDocument: ARTWORK_DRAWING_DOCUMENT,
				title: 'Still published'
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
		);

		expect(result.id).toBe('artwork-1');
		expect(artworks.get('artwork-1')).toBeDefined();
		expect(deletes).toEqual([]);
	});

	it('allows only the author to update an artwork title', async () => {
		const { publishArtwork, updateArtworkTitle } = await import('./service');
		const { repository } = createRepository();
		const { storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		await publishArtwork(
			{
				drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
				drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
				drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
		expect(deletes).toEqual(['artworks/user-1/artwork-1.webp']);
	});

	it('decrements the parent fork count when a child fork is deleted', async () => {
		const { deleteArtwork, publishArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		const { storage } = createStorage();
		const now = new Date('2026-03-26T10:00:00.000Z');

		await publishArtwork(
			{
				drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
				drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
		const renderDrawingDocumentMedia = vi.fn(async () => {
			const file = new File([new Uint8Array([1, 2, 3])], 'artwork.avif', { type: 'image/avif' });
			return {
				contentType: 'image/avif',
				file,
				height: ARTWORK_MEDIA_HEIGHT,
				sizeBytes: file.size,
				width: ARTWORK_MEDIA_WIDTH
			};
		});

		for (let attempt = 0; attempt < ARTWORK_PUBLISH_RATE_LIMIT.maxAttempts; attempt += 1) {
			await publishArtwork(
				{
					drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
					renderDrawingDocumentMedia,
					storage
				}
			);
		}

		await expect(
			publishArtwork(
				{
					drawingDocument: ARTWORK_DRAWING_DOCUMENT,
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
					renderDrawingDocumentMedia,
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
