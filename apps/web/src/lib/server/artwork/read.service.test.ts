import { describe, expect, it } from 'vitest';
import { ArtworkFlowError } from './errors';
import { deleteArtwork, publishArtwork } from './service';
import type {
	ArtworkDiscoveryTopWindow,
	ArtworkReadRecord,
	ArtworkReadRepository,
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

type ProfileRecord = {
	avatarUrl: string | null;
	id: string;
	nickname: string;
};

const HOT_RANKING_GRAVITY = 1.5;

const compareRecent = (
	left: Pick<ArtworkRecord, 'createdAt' | 'id'>,
	right: Pick<ArtworkRecord, 'createdAt' | 'id'>
) => {
	const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
	if (createdAtDelta !== 0) return createdAtDelta;

	return right.id.localeCompare(left.id);
};

const getHotRankingValue = (record: ArtworkRecord, now: Date) => {
	const hoursSincePublish = Math.max(0, (now.getTime() - record.createdAt.getTime()) / 3_600_000);

	return record.score / (hoursSincePublish + 2) ** HOT_RANKING_GRAVITY;
};

const getTopWindowStart = (now: Date, window: ArtworkDiscoveryTopWindow) => {
	if (window === 'all') return null;

	if (window === 'today') {
		return new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
		);
	}

	const day = now.getUTCDay();
	const isoDayOffset = day === 0 ? 6 : day - 1;

	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - isoDayOffset, 0, 0, 0, 0)
	);
};

const isAfterRankedCursor = (
	record: ArtworkReadRecord,
	cursor: { createdAt: Date; id: string; rankingValue: number } | null
) => {
	if (!cursor) return true;

	if ((record.rankingValue ?? 0) < cursor.rankingValue) return true;
	if ((record.rankingValue ?? 0) > cursor.rankingValue) return false;
	if (record.createdAt.getTime() < cursor.createdAt.getTime()) return true;
	if (record.createdAt.getTime() > cursor.createdAt.getTime()) return false;

	return record.id.localeCompare(cursor.id) < 0;
};

const createProfiles = () =>
	new Map<string, ProfileRecord>([
		[
			'user-1',
			{
				avatarUrl: 'https://cdn.not-the-louvre.test/avatars/user-1.avif',
				id: 'user-1',
				nickname: 'artist_1'
			}
		],
		[
			'user-2',
			{
				avatarUrl: null,
				id: 'user-2',
				nickname: 'artist_2'
			}
		]
	]);

const createWriteRepository = (artworks: Map<string, ArtworkRecord>) => {
	const rateLimits = new Map<string, PublishRateLimitRecord>();

	const repository: ArtworkRepository = {
		createContentReport: async () => {
			throw new Error('not implemented in read tests');
		},
		findVoteByArtworkAndUser: async () => null,
		upsertVote: async () => {
			throw new Error('not implemented in read tests');
		},
		removeVote: async () => {
			throw new Error('not implemented in read tests');
		},
		findEngagementRateLimit: async () => null,
		createEngagementRateLimit: async () => {
			throw new Error('not implemented in read tests');
		},
		updateEngagementRateLimit: async () => {
			throw new Error('not implemented in read tests');
		},
		listCommentsByArtworkId: async () => [],
		createComment: async () => {
			throw new Error('not implemented in read tests');
		},
		findCommentById: async () => null,
		findCommentReportCount: async () => 0,
		findArtworkReportCount: async () => 0,
		deleteComment: async () => {
			throw new Error('not implemented in read tests');
		},
		findArtworkById: async (id: string) => artworks.get(id) ?? null,
		findChildForksByParentId: async (parentId: string) =>
			Array.from(artworks.values()).filter((artwork) => artwork.parentId === parentId),
		createArtwork: async (input) => {
			const record: ArtworkRecord = {
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
		},
		updateArtworkTitle: async (id: string, title: string, updatedAt: Date) => {
			const current = artworks.get(id);
			if (!current) return null;

			const next = { ...current, title, updatedAt };
			artworks.set(id, next);
			return next;
		},
		deleteArtwork: async (id: string) => {
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
		},
		setArtworkHiddenState: async (id: string, input) => {
			const current = artworks.get(id);
			if (!current) return null;
			const next = { ...current, ...input };
			artworks.set(id, next);
			return next;
		},
		setCommentHiddenState: async () => {
			throw new Error('not implemented in read tests');
		},
		findPublishRateLimit: async (actorKey: string) => rateLimits.get(actorKey) ?? null,
		createPublishRateLimit: async (input) => {
			const record: PublishRateLimitRecord = {
				...input
			};

			rateLimits.set(record.actorKey, record);
			return record;
		},
		updatePublishRateLimit: async (id: string, input) => {
			const current = Array.from(rateLimits.values()).find((candidate) => candidate.id === id);
			if (!current) throw new Error(`Missing publish rate limit ${id}`);

			const next = { ...current, ...input };
			rateLimits.set(current.actorKey, next);
			return next;
		}
	};

	return { repository };
};

const createReadRepository = (
	artworks: Map<string, ArtworkRecord>,
	profiles: Map<string, ProfileRecord>
): ArtworkReadRepository => ({
	async listRecentArtworks({ cursor, limit, viewer }) {
		return Array.from(artworks.values())
			.filter(
				(record) => !record.isHidden || viewer?.isModerator || record.authorId === viewer?.userId
			)
			.sort((left, right) => {
				const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
				if (createdAtDelta !== 0) return createdAtDelta;

				return right.id.localeCompare(left.id);
			})
			.filter((record) => {
				if (!cursor) return true;

				if (record.createdAt.getTime() < cursor.createdAt.getTime()) return true;
				if (record.createdAt.getTime() > cursor.createdAt.getTime()) return false;

				return record.id.localeCompare(cursor.id) < 0;
			})
			.slice(0, limit)
			.map((record) => {
				const profile = profiles.get(record.authorId);
				if (!profile) throw new Error(`Missing profile ${record.authorId}`);

				const readRecord: ArtworkReadRecord = {
					...record,
					authorAvatarUrl: profile.avatarUrl,
					authorNickname: profile.nickname,
					commentCount: record.commentCount ?? 0,
					score: record.score ?? 0
				};

				return readRecord;
			});
	},
	async listHotArtworks({ cursor, limit, now, viewer }) {
		return Array.from(artworks.values())
			.filter(
				(record) => !record.isHidden || viewer?.isModerator || record.authorId === viewer?.userId
			)
			.map((record) => {
				const profile = profiles.get(record.authorId);
				if (!profile) throw new Error(`Missing profile ${record.authorId}`);

				const readRecord: ArtworkReadRecord = {
					...record,
					authorAvatarUrl: profile.avatarUrl,
					authorNickname: profile.nickname,
					commentCount: record.commentCount ?? 0,
					rankingValue: getHotRankingValue(record, now),
					score: record.score ?? 0
				};

				return readRecord;
			})
			.sort((left, right) => {
				const rankingDelta = (right.rankingValue ?? 0) - (left.rankingValue ?? 0);
				if (rankingDelta !== 0) return rankingDelta;

				return compareRecent(left, right);
			})
			.filter((record) =>
				isAfterRankedCursor(
					record,
					cursor
						? {
								createdAt: cursor.createdAt,
								id: cursor.id,
								rankingValue: cursor.rankingValue
							}
						: null
				)
			)
			.slice(0, limit);
	},
	async findArtworkDetailById(id, viewer) {
		const record = artworks.get(id);
		if (!record) return null;
		if (record.isHidden && !viewer?.isModerator && record.authorId !== viewer?.userId) return null;

		const profile = profiles.get(record.authorId);
		if (!profile) throw new Error(`Missing profile ${record.authorId}`);
		const parent = record.parentId
			? (() => {
					const candidate = artworks.get(record.parentId) ?? null;
					if (!candidate || candidate.isHidden) return null;
					return candidate;
				})()
			: null;
		const parentProfile = parent ? (profiles.get(parent.authorId) ?? null) : null;
		const childForks = Array.from(artworks.values())
			.filter((candidate) => candidate.parentId === record.id && !candidate.isHidden)
			.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
			.map((child) => {
				const childProfile = profiles.get(child.authorId);
				if (!childProfile) throw new Error(`Missing profile ${child.authorId}`);

				return {
					authorAvatarUrl: childProfile.avatarUrl,
					authorId: child.authorId,
					authorNickname: childProfile.nickname,
					createdAt: child.createdAt,
					id: child.id,
					title: child.title
				};
			});

		return {
			...record,
			authorAvatarUrl: profile.avatarUrl,
			authorNickname: profile.nickname,
			commentCount: record.commentCount ?? 0,
			parentAuthorAvatarUrl: parentProfile?.avatarUrl ?? null,
			parentAuthorId: parent?.authorId ?? null,
			parentAuthorNickname: parentProfile?.nickname ?? null,
			parentId: record.parentId ?? null,
			parentTitle: parent?.title ?? null,
			score: record.score ?? 0,
			childForks
		};
	},
	async findArtworkMediaById(id, viewer) {
		const record = artworks.get(id);
		if (!record) return null;
		if (record.isHidden && !viewer?.isModerator && record.authorId !== viewer?.userId) return null;

		return {
			id: record.id,
			mediaContentType: record.mediaContentType,
			storageKey: record.storageKey
		};
	},
	async listTopArtworks({ cursor, limit, now, window, viewer }) {
		const windowStart = getTopWindowStart(now, window);

		return Array.from(artworks.values())
			.filter(
				(record) => !record.isHidden || viewer?.isModerator || record.authorId === viewer?.userId
			)
			.filter((record) => !windowStart || record.createdAt >= windowStart)
			.map((record) => {
				const profile = profiles.get(record.authorId);
				if (!profile) throw new Error(`Missing profile ${record.authorId}`);

				const readRecord: ArtworkReadRecord = {
					...record,
					authorAvatarUrl: profile.avatarUrl,
					authorNickname: profile.nickname,
					commentCount: record.commentCount ?? 0,
					rankingValue: record.score ?? 0,
					score: record.score ?? 0
				};

				return readRecord;
			})
			.sort((left, right) => {
				const rankingDelta = (right.rankingValue ?? 0) - (left.rankingValue ?? 0);
				if (rankingDelta !== 0) return rankingDelta;

				return compareRecent(left, right);
			})
			.filter((record) =>
				isAfterRankedCursor(
					record,
					cursor
						? {
								createdAt: cursor.createdAt,
								id: cursor.id,
								rankingValue: cursor.rankingValue
							}
						: null
				)
			)
			.slice(0, limit);
	},
	async listArtworkCommentsByArtworkId() {
		return [];
	}
});

const asReadDeps = (repository: ArtworkReadRepository, now?: () => Date) => ({
	repository,
	...(now ? { now } : {})
});

const asViewer = (profile: ProfileRecord) => ({
	user: {
		id: profile.id,
		role: 'user' as const
	}
});

const createStorage = () => {
	const storage: ArtworkStorage = {
		upload: async () => undefined,
		delete: async () => undefined
	};

	return { storage };
};

const createActor = (profile: ProfileRecord) => {
	const now = new Date('2026-03-26T10:00:00.000Z');

	return {
		user: {
			id: profile.id,
			authUserId: profile.id,
			nickname: profile.nickname,
			role: 'user' as const,
			avatarUrl: profile.avatarUrl,
			name: profile.nickname,
			email: `${profile.nickname}@not-the-louvre.local`,
			emailVerified: true,
			image: null,
			createdAt: now,
			updatedAt: now
		}
	};
};

describe('artwork read service', () => {
	it('returns recent artworks newest-first with stable cursor continuation', async () => {
		const { listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const { repository } = createWriteRepository(artworks);
		const readRepository = createReadRepository(artworks, profiles);
		const { storage } = createStorage();

		await publishArtwork(
			{ media: createAvifFile(), title: 'First in time' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-001',
				now: () => new Date('2026-03-26T10:00:00.000Z'),
				repository,
				storage
			}
		);

		await publishArtwork(
			{ media: createAvifFile(), title: 'Second in time' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-002',
				now: () => new Date('2026-03-26T11:00:00.000Z'),
				repository,
				storage
			}
		);

		await publishArtwork(
			{ media: createAvifFile(), title: 'Newest tie-breaker' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-2')!) },
			{
				generateId: () => 'artwork-003',
				now: () => new Date('2026-03-26T11:00:00.000Z'),
				repository,
				storage
			}
		);

		const firstPage = await listArtworkDiscovery(
			{ limit: 2, sort: 'recent' },
			asReadDeps(readRepository)
		);

		expect(firstPage.sort).toBe('recent');
		expect(firstPage.items.map((artwork) => artwork.id)).toEqual(['artwork-003', 'artwork-002']);
		expect(firstPage.pageInfo.hasMore).toBe(true);
		expect(firstPage.pageInfo.nextCursor).toEqual(expect.any(String));

		const secondPage = await listArtworkDiscovery(
			{ cursor: firstPage.pageInfo.nextCursor, limit: 2, sort: 'recent' },
			asReadDeps(readRepository)
		);

		expect(secondPage.items.map((artwork) => artwork.id)).toEqual(['artwork-001']);
		expect(secondPage.pageInfo.hasMore).toBe(false);
		expect(secondPage.pageInfo.nextCursor).toBeNull();
	});

	it('accepts supported discovery sorts and requires a top window only for top feeds', async () => {
		const { listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const readRepository = createReadRepository(artworks, profiles);

		await expect(
			listArtworkDiscovery(
				{ sort: 'hot' },
				asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
			)
		).resolves.toMatchObject({ sort: 'hot' });

		await expect(
			listArtworkDiscovery(
				{ sort: 'top', window: 'today' },
				asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
			)
		).resolves.toMatchObject({ sort: 'top' });

		await expect(
			listArtworkDiscovery(
				{ sort: 'top' },
				asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
			)
		).rejects.toMatchObject({ code: 'INVALID_WINDOW', status: 400 });

		await expect(
			listArtworkDiscovery(
				{ sort: 'hot', window: 'today' },
				asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
			)
		).resolves.toMatchObject({ sort: 'hot' });
	});

	it('rejects unsupported discovery sorts and top windows', async () => {
		const { listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const readRepository = createReadRepository(artworks, profiles);

		await expect(
			listArtworkDiscovery(
				{ sort: 'controversial' as never },
				asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
			)
		).rejects.toMatchObject({ code: 'INVALID_SORT', status: 400 });

		await expect(
			listArtworkDiscovery(
				{ sort: 'top', window: 'month' as never },
				asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
			)
		).rejects.toMatchObject({ code: 'INVALID_WINDOW', status: 400 });
	});

	it('orders hot feeds by recency-weighted score and preserves deterministic pagination', async () => {
		const { listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>([
			[
				'artwork-old-high',
				{
					authorId: 'user-1',
					commentCount: 1,
					createdAt: new Date('2026-03-24T12:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-old-high',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 10,
					storageKey: 'artworks/user-1/old-high.avif',
					title: 'Old high',
					updatedAt: new Date('2026-03-24T12:00:00.000Z')
				}
			],
			[
				'artwork-fresh-mid',
				{
					authorId: 'user-2',
					commentCount: 2,
					createdAt: new Date('2026-03-26T11:00:00.000Z'),
					forkCount: 1,
					id: 'artwork-fresh-mid',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 6,
					storageKey: 'artworks/user-2/fresh-mid.avif',
					title: 'Fresh mid',
					updatedAt: new Date('2026-03-26T11:00:00.000Z')
				}
			],
			[
				'artwork-hot-tie-b',
				{
					authorId: 'user-1',
					commentCount: 0,
					createdAt: new Date('2026-03-26T10:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-hot-tie-b',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 4,
					storageKey: 'artworks/user-1/hot-tie-b.avif',
					title: 'Hot tie B',
					updatedAt: new Date('2026-03-26T10:00:00.000Z')
				}
			],
			[
				'artwork-hot-tie-a',
				{
					authorId: 'user-2',
					commentCount: 0,
					createdAt: new Date('2026-03-26T10:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-hot-tie-a',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 4,
					storageKey: 'artworks/user-2/hot-tie-a.avif',
					title: 'Hot tie A',
					updatedAt: new Date('2026-03-26T10:00:00.000Z')
				}
			]
		]);
		const profiles = createProfiles();
		const readRepository = createReadRepository(artworks, profiles);

		const firstPage = await listArtworkDiscovery(
			{ limit: 2, sort: 'hot' },
			asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
		);

		expect(firstPage.items.map((artwork) => artwork.id)).toEqual([
			'artwork-fresh-mid',
			'artwork-hot-tie-b'
		]);
		expect(firstPage.items[0]).toMatchObject({
			author: { id: 'user-2', nickname: 'artist_2' },
			commentCount: 2,
			forkCount: 1,
			mediaUrl: '/api/artworks/artwork-fresh-mid/media',
			title: 'Fresh mid'
		});
		expect(firstPage.items[0]).not.toHaveProperty('storageKey');
		expect(firstPage.pageInfo.hasMore).toBe(true);

		const secondPage = await listArtworkDiscovery(
			{ cursor: firstPage.pageInfo.nextCursor, limit: 2, sort: 'hot' },
			asReadDeps(readRepository, () => new Date('2026-03-26T18:00:00.000Z'))
		);

		expect(secondPage.items.map((artwork) => artwork.id)).toEqual([
			'artwork-hot-tie-a',
			'artwork-old-high'
		]);
		expect(secondPage.pageInfo.hasMore).toBe(false);
	});

	it('filters top windows and paginates deterministically with score tie-breakers', async () => {
		const { listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>([
			[
				'artwork-today-top',
				{
					authorId: 'user-1',
					commentCount: 3,
					createdAt: new Date('2026-03-26T10:30:00.000Z'),
					forkCount: 1,
					id: 'artwork-today-top',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 12,
					storageKey: 'artworks/user-1/today-top.avif',
					title: 'Today top',
					updatedAt: new Date('2026-03-26T10:30:00.000Z')
				}
			],
			[
				'artwork-today-tie-b',
				{
					authorId: 'user-2',
					commentCount: 1,
					createdAt: new Date('2026-03-26T08:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-today-tie-b',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 7,
					storageKey: 'artworks/user-2/today-tie-b.avif',
					title: 'Today tie B',
					updatedAt: new Date('2026-03-26T08:00:00.000Z')
				}
			],
			[
				'artwork-today-tie-a',
				{
					authorId: 'user-1',
					commentCount: 1,
					createdAt: new Date('2026-03-26T08:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-today-tie-a',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 7,
					storageKey: 'artworks/user-1/today-tie-a.avif',
					title: 'Today tie A',
					updatedAt: new Date('2026-03-26T08:00:00.000Z')
				}
			],
			[
				'artwork-this-week',
				{
					authorId: 'user-2',
					commentCount: 0,
					createdAt: new Date('2026-03-24T09:00:00.000Z'),
					forkCount: 0,
					id: 'artwork-this-week',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 9,
					storageKey: 'artworks/user-2/this-week.avif',
					title: 'This week',
					updatedAt: new Date('2026-03-24T09:00:00.000Z')
				}
			],
			[
				'artwork-old-all-time',
				{
					authorId: 'user-1',
					commentCount: 4,
					createdAt: new Date('2026-03-18T09:00:00.000Z'),
					forkCount: 2,
					id: 'artwork-old-all-time',
					mediaContentType: 'image/avif',
					mediaSizeBytes: 128,
					parentId: null,
					score: 20,
					storageKey: 'artworks/user-1/old-all-time.avif',
					title: 'Old all time',
					updatedAt: new Date('2026-03-18T09:00:00.000Z')
				}
			]
		]);
		const profiles = createProfiles();
		const readRepository = createReadRepository(artworks, profiles);

		const todayPage = await listArtworkDiscovery(
			{ limit: 2, sort: 'top', window: 'today' },
			asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
		);

		expect(todayPage.items.map((artwork) => artwork.id)).toEqual([
			'artwork-today-top',
			'artwork-today-tie-b'
		]);
		expect(todayPage.pageInfo.hasMore).toBe(true);

		const todayNextPage = await listArtworkDiscovery(
			{ cursor: todayPage.pageInfo.nextCursor, limit: 2, sort: 'top', window: 'today' },
			asReadDeps(readRepository, () => new Date('2026-03-27T12:00:00.000Z'))
		);

		expect(todayNextPage.items.map((artwork) => artwork.id)).toEqual(['artwork-today-tie-a']);

		const weekPage = await listArtworkDiscovery(
			{ limit: 10, sort: 'top', window: 'week' },
			asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
		);
		expect(weekPage.items.map((artwork) => artwork.id)).toEqual([
			'artwork-today-top',
			'artwork-this-week',
			'artwork-today-tie-b',
			'artwork-today-tie-a'
		]);

		const allTimePage = await listArtworkDiscovery(
			{ limit: 10, sort: 'top', window: 'all' },
			asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
		);
		expect(allTimePage.items.map((artwork) => artwork.id)).toEqual([
			'artwork-old-all-time',
			'artwork-today-top',
			'artwork-this-week',
			'artwork-today-tie-b',
			'artwork-today-tie-a'
		]);
	});

	it('rejects ranked cursor reuse across sorts and top windows', async () => {
		const { listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const readRepository = createReadRepository(artworks, profiles);

		const hotCursor = Buffer.from(
			JSON.stringify({
				createdAt: '2026-03-26T10:00:00.000Z',
				id: 'artwork-1',
				rankingValue: 1,
				snapshotAt: '2026-03-26T12:00:00.000Z',
				sort: 'hot'
			}),
			'utf8'
		).toString('base64url');

		await expect(
			listArtworkDiscovery(
				{ cursor: hotCursor, sort: 'top', window: 'today' },
				asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
			)
		).rejects.toMatchObject({ code: 'INVALID_CURSOR', status: 400 });

		const topWeekCursor = Buffer.from(
			JSON.stringify({
				createdAt: '2026-03-26T10:00:00.000Z',
				id: 'artwork-1',
				rankingValue: 1,
				snapshotAt: '2026-03-26T12:00:00.000Z',
				sort: 'top',
				window: 'week'
			}),
			'utf8'
		).toString('base64url');

		await expect(
			listArtworkDiscovery(
				{ cursor: topWeekCursor, sort: 'top', window: 'today' },
				asReadDeps(readRepository, () => new Date('2026-03-26T12:00:00.000Z'))
			)
		).rejects.toMatchObject({ code: 'INVALID_CURSOR', status: 400 });
	});

	it('returns feed and detail projections with canonical author summary and media URL fields', async () => {
		const { getArtworkDetail, listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const { repository } = createWriteRepository(artworks);
		const readRepository = createReadRepository(artworks, profiles);
		const { storage } = createStorage();

		await publishArtwork(
			{ media: createAvifFile(), title: 'Projection test' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-101',
				now: () => new Date('2026-03-26T12:00:00.000Z'),
				repository,
				storage
			}
		);

		const discovery = await listArtworkDiscovery(
			{ limit: 10, sort: 'recent' },
			asReadDeps(readRepository)
		);
		const detail = await getArtworkDetail(
			'artwork-101',
			asViewer(profiles.get('user-1')!),
			asReadDeps(readRepository)
		);

		expect(discovery.items[0]).toMatchObject({
			id: 'artwork-101',
			title: 'Projection test',
			mediaUrl: '/api/artworks/artwork-101/media',
			commentCount: 0,
			forkCount: 0,
			lineage: {
				isFork: false,
				parent: null,
				parentStatus: 'none'
			},
			score: 0,
			author: {
				id: 'user-1',
				nickname: 'artist_1',
				avatarUrl: 'https://cdn.not-the-louvre.test/avatars/user-1.avif'
			}
		});
		expect(discovery.items[0]).not.toHaveProperty('storageKey');

		expect(detail).toMatchObject({
			id: 'artwork-101',
			title: 'Projection test',
			mediaUrl: '/api/artworks/artwork-101/media',
			mediaContentType: 'image/avif',
			mediaSizeBytes: 128,
			childForks: [],
			commentCount: 0,
			forkCount: 0,
			lineage: {
				isFork: false,
				parent: null,
				parentStatus: 'none'
			},
			score: 0,
			author: {
				id: 'user-1',
				nickname: 'artist_1',
				avatarUrl: 'https://cdn.not-the-louvre.test/avatars/user-1.avif'
			}
		});
		expect(detail).not.toHaveProperty('storageKey');
	});

	it('returns parent attribution and direct child fork summaries for fork-aware detail reads', async () => {
		const { getArtworkDetail } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const { repository } = createWriteRepository(artworks);
		const readRepository = createReadRepository(artworks, profiles);
		const { storage } = createStorage();

		await publishArtwork(
			{ media: createAvifFile(), title: 'Parent artwork' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-parent',
				now: () => new Date('2026-03-26T12:00:00.000Z'),
				repository,
				storage
			}
		);

		await publishArtwork(
			{
				media: createAvifFile(),
				parentArtworkId: 'artwork-parent',
				title: 'Fork artwork'
			},
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-2')!) },
			{
				generateId: () => 'artwork-child',
				now: () => new Date('2026-03-26T13:00:00.000Z'),
				repository,
				storage
			}
		);

		await publishArtwork(
			{
				media: createAvifFile(),
				parentArtworkId: 'artwork-parent',
				title: 'Second fork artwork'
			},
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-child-2',
				now: () => new Date('2026-03-26T14:00:00.000Z'),
				repository,
				storage
			}
		);

		const childDetail = await getArtworkDetail(
			'artwork-child',
			asViewer(profiles.get('user-2')!),
			asReadDeps(readRepository)
		);
		const parentDetail = await getArtworkDetail(
			'artwork-parent',
			asViewer(profiles.get('user-1')!),
			asReadDeps(readRepository)
		);

		expect(childDetail.lineage).toMatchObject({
			isFork: true,
			parentStatus: 'available',
			parent: {
				id: 'artwork-parent',
				title: 'Parent artwork',
				author: {
					id: 'user-1',
					nickname: 'artist_1'
				}
			}
		});
		expect(parentDetail.childForks.map((fork) => fork.id)).toEqual([
			'artwork-child-2',
			'artwork-child'
		]);
		expect(parentDetail.forkCount).toBe(2);
	});

	it('preserves fork attribution when a parent artwork is deleted later', async () => {
		const { getArtworkDetail } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const { repository } = createWriteRepository(artworks);
		const readRepository = createReadRepository(artworks, profiles);
		const { storage } = createStorage();

		await publishArtwork(
			{ media: createAvifFile(), title: 'Parent artwork' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-parent',
				now: () => new Date('2026-03-26T12:00:00.000Z'),
				repository,
				storage
			}
		);

		await publishArtwork(
			{
				media: createAvifFile(),
				parentArtworkId: 'artwork-parent',
				title: 'Fork artwork'
			},
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-2')!) },
			{
				generateId: () => 'artwork-child',
				now: () => new Date('2026-03-26T13:00:00.000Z'),
				repository,
				storage
			}
		);

		await deleteArtwork({ artworkId: 'artwork-parent' }, createActor(profiles.get('user-1')!), {
			repository,
			storage
		});

		const detail = await getArtworkDetail(
			'artwork-child',
			asViewer(profiles.get('user-2')!),
			asReadDeps(readRepository)
		);

		expect(detail.lineage).toMatchObject({
			isFork: true,
			parent: null,
			parentStatus: 'deleted'
		});
	});

	it('omits deleted artworks from discovery and returns not found for deleted detail reads', async () => {
		const { getArtworkDetail, listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const { repository } = createWriteRepository(artworks);
		const readRepository = createReadRepository(artworks, profiles);
		const { storage } = createStorage();

		await publishArtwork(
			{ media: createAvifFile(), title: 'Keep me' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-201',
				now: () => new Date('2026-03-26T13:00:00.000Z'),
				repository,
				storage
			}
		);

		await publishArtwork(
			{ media: createAvifFile(), title: 'Delete me' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-202',
				now: () => new Date('2026-03-26T14:00:00.000Z'),
				repository,
				storage
			}
		);

		await deleteArtwork({ artworkId: 'artwork-202' }, createActor(profiles.get('user-1')!), {
			repository,
			storage
		});

		const discovery = await listArtworkDiscovery(
			{ limit: 10, sort: 'recent' },
			asReadDeps(readRepository)
		);

		expect(discovery.items.map((artwork) => artwork.id)).toEqual(['artwork-201']);

		await expect(
			getArtworkDetail('artwork-202', asViewer(profiles.get('user-1')!), asReadDeps(readRepository))
		).rejects.toMatchObject({
			code: 'NOT_FOUND',
			status: 404
		});
		await expect(
			getArtworkDetail(
				'missing-artwork',
				asViewer(profiles.get('user-1')!),
				asReadDeps(readRepository)
			)
		).rejects.toBeInstanceOf(ArtworkFlowError);
	});

	it('keeps ranked feeds compatible with active-content filtering and not-found detail semantics', async () => {
		const { getArtworkDetail, listArtworkDiscovery } = await import('./read.service');
		const artworks = new Map<string, ArtworkRecord>();
		const profiles = createProfiles();
		const { repository } = createWriteRepository(artworks);
		const readRepository = createReadRepository(artworks, profiles);
		const { storage } = createStorage();

		await publishArtwork(
			{ media: createAvifFile(), title: 'Visible ranked artwork' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-1')!) },
			{
				generateId: () => 'artwork-ranked-visible',
				now: () => new Date('2026-03-26T12:00:00.000Z'),
				repository,
				storage
			}
		);

		await publishArtwork(
			{ media: createAvifFile(), title: 'Deleted ranked artwork' },
			{ ipAddress: '127.0.0.1', ...createActor(profiles.get('user-2')!) },
			{
				generateId: () => 'artwork-ranked-deleted',
				now: () => new Date('2026-03-26T11:00:00.000Z'),
				repository,
				storage
			}
		);

		await deleteArtwork(
			{ artworkId: 'artwork-ranked-deleted' },
			createActor(profiles.get('user-2')!),
			{
				repository,
				storage
			}
		);

		const hotDiscovery = await listArtworkDiscovery(
			{ limit: 10, sort: 'hot' },
			asReadDeps(readRepository, () => new Date('2026-03-26T12:30:00.000Z'))
		);
		const topDiscovery = await listArtworkDiscovery(
			{ limit: 10, sort: 'top', window: 'today' },
			asReadDeps(readRepository, () => new Date('2026-03-26T12:30:00.000Z'))
		);

		expect(hotDiscovery.items.map((artwork) => artwork.id)).toEqual(['artwork-ranked-visible']);
		expect(topDiscovery.items.map((artwork) => artwork.id)).toEqual(['artwork-ranked-visible']);

		await expect(
			getArtworkDetail(
				'artwork-ranked-deleted',
				asViewer(profiles.get('user-2')!),
				asReadDeps(readRepository)
			)
		).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
	});
});
