import { and, asc, desc, eq, gte, lt, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artworkComments, artworks, users } from '$lib/server/db/schema';
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
	isHidden: artworks.isHidden,
	hiddenAt: artworks.hiddenAt,
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
	hiddenAt: Date | null;
	id: string;
	isHidden: boolean;
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

const artworkVisibilityWhere = (viewer: { isModerator: boolean; userId: string | null }) =>
	viewer.isModerator
		? undefined
		: viewer.userId
			? or(eq(artworks.isHidden, false), eq(artworks.authorId, viewer.userId))
			: eq(artworks.isHidden, false);

const commentVisibilityWhere = (
	artworkId: string,
	viewer: { isModerator: boolean; userId: string | null }
) =>
	viewer.isModerator
		? eq(artworkComments.artworkId, artworkId)
		: viewer.userId
			? and(
					eq(artworkComments.artworkId, artworkId),
					or(eq(artworkComments.isHidden, false), eq(artworkComments.authorId, viewer.userId))
				)
			: and(eq(artworkComments.artworkId, artworkId), eq(artworkComments.isHidden, false));

const defaultViewer = (viewer?: { isModerator: boolean; userId: string | null }) => ({
	isModerator: viewer?.isModerator ?? false,
	userId: viewer?.userId ?? null
});

const mapRow = (row: ArtworkReadRow): ArtworkReadRecord => ({
	authorAvatarUrl: row.authorAvatarUrl,
	authorId: row.authorId,
	authorNickname: row.authorNickname,
	commentCount: row.commentCount,
	createdAt: row.createdAt,
	forkCount: row.forkCount,
	hiddenAt: row.hiddenAt,
	id: row.id,
	isHidden: row.isHidden,
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
		const viewer = defaultViewer(input.viewer);
		const rows = await db
			.select(baseSelect)
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(and(artworkVisibilityWhere(viewer), recentCursorWhere(input.cursor) ?? undefined))
			.orderBy(desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},
	async listHotArtworks(input: ListHotArtworksInput) {
		const viewer = defaultViewer(input.viewer);
		const rankingExpression = hotRankingSql(input.now);
		const rows = await db
			.select(rankedBaseSelect(rankingExpression))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(
				and(
					artworkVisibilityWhere(viewer),
					rankedCursorWhere(input.cursor, rankingExpression) ?? undefined
				)
			)
			.orderBy(desc(rankingExpression), desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},
	async listTopArtworks(input: ListTopArtworksInput) {
		const viewer = defaultViewer(input.viewer);
		const rankingExpression = sql<number>`${artworks.score}::double precision`;
		const windowStart = getTopWindowStart(input.now, input.window);
		const rows = await db
			.select(rankedBaseSelect(rankingExpression))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(
				and(
					artworkVisibilityWhere(viewer),
					windowStart ? gte(artworks.createdAt, windowStart) : undefined,
					rankedCursorWhere(input.cursor, rankingExpression) ?? undefined
				)
			)
			.orderBy(desc(artworks.score), desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},
	async findArtworkDetailById(id, viewer) {
		const activeViewer = defaultViewer(viewer);
		const row = await db
			.select(baseSelect)
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(and(eq(artworks.id, id), artworkVisibilityWhere(activeViewer)))
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
					.where(and(eq(artworks.id, record.parentId), eq(artworks.isHidden, false)))
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
			.where(and(eq(artworks.parentId, record.id), eq(artworks.isHidden, false)))
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
	async findArtworkMediaById(id, viewer) {
		const activeViewer = defaultViewer(viewer);
		const row = await db
			.select({
				id: artworks.id,
				mediaContentType: artworks.mediaContentType,
				storageKey: artworks.storageKey
			})
			.from(artworks)
			.where(and(eq(artworks.id, id), artworkVisibilityWhere(activeViewer)))
			.limit(1);

		return row[0] ?? null;
	},
	async listArtworkCommentsByArtworkId(artworkId, viewer) {
		const activeViewer = defaultViewer(viewer);
		const rows = await db
			.select({
				authorAvatarUrl: users.avatarUrl,
				authorId: artworkComments.authorId,
				authorNickname: users.nickname,
				artworkId: artworkComments.artworkId,
				body: artworkComments.body,
				createdAt: artworkComments.createdAt,
				id: artworkComments.id,
				updatedAt: artworkComments.updatedAt
			})
			.from(artworkComments)
			.innerJoin(users, eq(users.id, artworkComments.authorId))
			.where(commentVisibilityWhere(artworkId, activeViewer))
			.orderBy(asc(artworkComments.createdAt), asc(artworkComments.id));

		return rows.map((row) => ({
			author: {
				avatarUrl: row.authorAvatarUrl,
				id: row.authorId,
				nickname: row.authorNickname
			},
			artworkId: row.artworkId,
			body: row.body,
			createdAt: row.createdAt,
			id: row.id,
			updatedAt: row.updatedAt
		}));
	}
};
