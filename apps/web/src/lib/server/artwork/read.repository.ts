import { and, desc, eq, gte, lt, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artworks, users } from '$lib/server/db/schema';
import type {
	ArtworkDiscoveryCursor,
	ArtworkDiscoveryTopWindow,
	ArtworkReadRecord,
	ArtworkReadRepository,
	ListHotArtworksInput,
	ListRecentArtworksInput,
	ListTopArtworksInput
} from './types';

const recentCursorWhere = (cursor: ArtworkDiscoveryCursor | null) => {
	if (!cursor) return undefined;

	return or(
		lt(artworks.createdAt, cursor.createdAt),
		and(eq(artworks.createdAt, cursor.createdAt), lt(artworks.id, cursor.id))
	);
};

const HOT_RANKING_GRAVITY = 1.5;

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

const hotRankingSql = (now: Date) =>
	sql<number>`(${artworks.score}::double precision / power(((extract(epoch from ${now}) - extract(epoch from ${artworks.createdAt})) / 3600.0) + 2, ${HOT_RANKING_GRAVITY}))`;

const rankedCursorWhere = (
	cursor:
		| Extract<ArtworkDiscoveryCursor, { sort: 'hot' }>
		| Extract<ArtworkDiscoveryCursor, { sort: 'top' }>
		| null,
	rankingExpression: ReturnType<typeof sql<number>>
) => {
	if (!cursor) return undefined;

	return or(
		lt(rankingExpression, cursor.rankingValue),
		and(
			eq(rankingExpression, cursor.rankingValue),
			or(
				lt(artworks.createdAt, cursor.createdAt),
				and(eq(artworks.createdAt, cursor.createdAt), lt(artworks.id, cursor.id))
			)
		)
	);
};

const baseSelect = {
	id: artworks.id,
	authorId: artworks.authorId,
	title: artworks.title,
	storageKey: artworks.storageKey,
	mediaContentType: artworks.mediaContentType,
	mediaSizeBytes: artworks.mediaSizeBytes,
	score: artworks.score,
	commentCount: artworks.commentCount,
	forkCount: artworks.forkCount,
	parentId: artworks.parentId,
	createdAt: artworks.createdAt,
	updatedAt: artworks.updatedAt,
	authorNickname: users.nickname,
	authorAvatarUrl: users.avatarUrl
};

type ArtworkReadRow = {
	authorAvatarUrl: string | null;
	authorId: string;
	authorNickname: string;
	createdAt: Date;
	id: string;
	mediaContentType: string;
	mediaSizeBytes: number;
	commentCount: number;
	forkCount: number;
	parentId: string | null;
	score: number;
	storageKey: string;
	title: string;
	updatedAt: Date;
	rankingValue?: number;
};

const mapRow = (row: ArtworkReadRow): ArtworkReadRecord => ({
	authorAvatarUrl: row.authorAvatarUrl,
	authorId: row.authorId,
	authorNickname: row.authorNickname,
	commentCount: row.commentCount,
	createdAt: row.createdAt,
	forkCount: row.forkCount,
	id: row.id,
	mediaContentType: row.mediaContentType,
	mediaSizeBytes: row.mediaSizeBytes,
	parentId: row.parentId,
	score: row.score,
	storageKey: row.storageKey,
	title: row.title,
	rankingValue: row.rankingValue,
	updatedAt: row.updatedAt
});

const rankedBaseSelect = (rankingExpression: ReturnType<typeof sql<number>>) => ({
	...baseSelect,
	rankingValue: rankingExpression.as('rankingValue')
});

export const artworkReadRepository: ArtworkReadRepository = {
	async listRecentArtworks(input: ListRecentArtworksInput) {
		const rows = await db
			.select(baseSelect)
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(recentCursorWhere(input.cursor) ?? undefined)
			.orderBy(desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},
	async listHotArtworks(input: ListHotArtworksInput) {
		const rankingExpression = hotRankingSql(input.now);
		const rows = await db
			.select(rankedBaseSelect(rankingExpression))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(rankedCursorWhere(input.cursor, rankingExpression) ?? undefined)
			.orderBy(desc(rankingExpression), desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},
	async listTopArtworks(input: ListTopArtworksInput) {
		const rankingExpression = sql<number>`${artworks.score}::double precision`;
		const windowStart = getTopWindowStart(input.now, input.window);
		const rows = await db
			.select(rankedBaseSelect(rankingExpression))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(
				and(
					windowStart ? gte(artworks.createdAt, windowStart) : undefined,
					rankedCursorWhere(input.cursor, rankingExpression) ?? undefined
				)
			)
			.orderBy(desc(artworks.score), desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},
	async findArtworkDetailById(id) {
		const row = await db
			.select(baseSelect)
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(eq(artworks.id, id))
			.limit(1);

		const record = row[0] ? mapRow(row[0]) : null;
		if (!record) return null;

		const parent = record.parentId
			? await db
					.select({
						authorAvatarUrl: users.avatarUrl,
						authorId: artworks.authorId,
						authorNickname: users.nickname,
						id: artworks.id,
						title: artworks.title
					})
					.from(artworks)
					.innerJoin(users, eq(users.id, artworks.authorId))
					.where(eq(artworks.id, record.parentId))
					.limit(1)
			: [];

		const childForkRows = await db
			.select({
				authorAvatarUrl: users.avatarUrl,
				authorId: artworks.authorId,
				authorNickname: users.nickname,
				createdAt: artworks.createdAt,
				id: artworks.id,
				title: artworks.title
			})
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(eq(artworks.parentId, record.id))
			.orderBy(desc(artworks.createdAt), desc(artworks.id));

		return {
			...record,
			childForks: childForkRows,
			parentAuthorAvatarUrl: parent[0]?.authorAvatarUrl ?? null,
			parentAuthorId: parent[0]?.authorId ?? null,
			parentAuthorNickname: parent[0]?.authorNickname ?? null,
			parentTitle: parent[0]?.title ?? null
		};
	},
	async findArtworkMediaById(id) {
		const row = await db
			.select({
				id: artworks.id,
				mediaContentType: artworks.mediaContentType,
				storageKey: artworks.storageKey
			})
			.from(artworks)
			.where(eq(artworks.id, id))
			.limit(1);

		return row[0] ?? null;
	}
};
