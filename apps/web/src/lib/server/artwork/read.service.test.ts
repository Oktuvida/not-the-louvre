import { describe, expect, it } from 'vitest';
import { ArtworkFlowError } from './errors';
import { deleteArtwork, publishArtwork } from './service';
import type {
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
		findArtworkById: async (id: string) => artworks.get(id) ?? null,
		createArtwork: async (input) => {
			const record: ArtworkRecord = {
				...input
			};

			artworks.set(record.id, record);
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
			if (current) artworks.delete(id);
			return current;
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
	async listRecentArtworks({ cursor, limit }) {
		return Array.from(artworks.values())
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
					authorNickname: profile.nickname
				};

				return readRecord;
			});
	},
	async findArtworkDetailById(id) {
		const record = artworks.get(id);
		if (!record) return null;

		const profile = profiles.get(record.authorId);
		if (!profile) throw new Error(`Missing profile ${record.authorId}`);

		return {
			...record,
			authorAvatarUrl: profile.avatarUrl,
			authorNickname: profile.nickname
		};
	},
	async findArtworkMediaById(id) {
		const record = artworks.get(id);
		if (!record) return null;

		return {
			id: record.id,
			mediaContentType: record.mediaContentType,
			storageKey: record.storageKey
		};
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
			{ repository: readRepository }
		);

		expect(firstPage.sort).toBe('recent');
		expect(firstPage.items.map((artwork) => artwork.id)).toEqual(['artwork-003', 'artwork-002']);
		expect(firstPage.pageInfo.hasMore).toBe(true);
		expect(firstPage.pageInfo.nextCursor).toEqual(expect.any(String));

		const secondPage = await listArtworkDiscovery(
			{ cursor: firstPage.pageInfo.nextCursor, limit: 2, sort: 'recent' },
			{ repository: readRepository }
		);

		expect(secondPage.items.map((artwork) => artwork.id)).toEqual(['artwork-001']);
		expect(secondPage.pageInfo.hasMore).toBe(false);
		expect(secondPage.pageInfo.nextCursor).toBeNull();
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
			{ repository: readRepository }
		);
		const detail = await getArtworkDetail('artwork-101', { repository: readRepository });

		expect(discovery.items[0]).toMatchObject({
			id: 'artwork-101',
			title: 'Projection test',
			mediaUrl: '/api/artworks/artwork-101/media',
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
			author: {
				id: 'user-1',
				nickname: 'artist_1',
				avatarUrl: 'https://cdn.not-the-louvre.test/avatars/user-1.avif'
			}
		});
		expect(detail).not.toHaveProperty('storageKey');
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
			{ repository: readRepository }
		);

		expect(discovery.items.map((artwork) => artwork.id)).toEqual(['artwork-201']);

		await expect(
			getArtworkDetail('artwork-202', { repository: readRepository })
		).rejects.toMatchObject({
			code: 'NOT_FOUND',
			status: 404
		});
		await expect(
			getArtworkDetail('missing-artwork', { repository: readRepository })
		).rejects.toBeInstanceOf(ArtworkFlowError);
	});
});
