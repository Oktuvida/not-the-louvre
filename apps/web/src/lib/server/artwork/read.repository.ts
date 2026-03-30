import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artworkComments, artworks, contentReports, users } from '$lib/server/db/schema';
import type {
	ArtworkDiscoveryCursor,
	ArtworkDiscoveryTopWindow,
	ArtworkReadRecord,
	ArtworkReadRepository,
	ListHotArtworksInput,
	ListModerationQueueInput,
	ListRecentArtworksInput,
	ListTopArtworksInput,
	ModerationQueueItem
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

const hotRankingSql = (now: Date) => {
	const nowEpochSeconds = now.getTime() / 1000;

	return sql<number>`(${artworks.score}::double precision / power(((${nowEpochSeconds} - extract(epoch from ${artworks.createdAt})) / 3600.0) + 2, ${HOT_RANKING_GRAVITY}))`;
};

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
	isNsfw: artworks.isNsfw,
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

const voteCountSql = (value: 'down' | 'up') =>
	sql<number>`coalesce((
		select count(*)::int
		from "app"."artwork_votes" vote
		where vote.artwork_id = ${artworks.id}
			and vote.value = ${sql.raw(`'${value}'::app.artwork_vote_value`)}
	), 0)`;

const viewerVoteSql = (viewer: { isModerator: boolean; userId: string | null }) =>
	viewer.userId
		? sql<'down' | 'up' | null>`(
			select vote.value
			from "app"."artwork_votes" vote
			where vote.artwork_id = ${artworks.id}
				and vote.user_id = ${viewer.userId}
			limit 1
		)`
		: sql<null>`null`;

const buildBaseSelect = (viewer: { isModerator: boolean; userId: string | null }) => ({
	...baseSelect,
	downvotes: voteCountSql('down').as('downvotes'),
	upvotes: voteCountSql('up').as('upvotes'),
	viewerVote: viewerVoteSql(viewer).as('viewerVote')
});

type ArtworkReadRow = {
	authorAvatarUrl: string | null;
	authorId: string;
	authorNickname: string;
	createdAt: Date;
	hiddenAt: Date | null;
	id: string;
	isHidden: boolean;
	isNsfw: boolean;
	mediaContentType: string;
	mediaSizeBytes: number;
	commentCount: number;
	forkCount: number;
	parentId: string | null;
	score: number;
	storageKey: string;
	title: string;
	updatedAt: Date;
	parentAuthorAvatarUrl?: string | null;
	parentAuthorId?: string | null;
	parentAuthorNickname?: string | null;
	parentTitle?: string | null;
	downvotes?: number;
	upvotes?: number;
	viewerVote?: 'down' | 'up' | null;
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
	isNsfw: row.isNsfw,
	mediaContentType: row.mediaContentType,
	mediaSizeBytes: row.mediaSizeBytes,
	parentAuthorAvatarUrl: row.parentAuthorAvatarUrl ?? null,
	parentAuthorId: row.parentAuthorId ?? null,
	parentAuthorNickname: row.parentAuthorNickname ?? null,
	parentId: row.parentId,
	parentTitle: row.parentTitle ?? null,
	score: row.score,
	storageKey: row.storageKey,
	title: row.title,
	downvotes: row.downvotes,
	upvotes: row.upvotes,
	viewerVote: row.viewerVote ?? null,
	rankingValue: row.rankingValue,
	updatedAt: row.updatedAt
});

const buildRankedBaseSelect = (
	viewer: { isModerator: boolean; userId: string | null },
	rankingExpression: ReturnType<typeof sql<number>>
) => ({
	...buildBaseSelect(viewer),
	rankingValue: rankingExpression.as('rankingValue')
});

const hydrateDiscoveryParents = async (records: ArtworkReadRecord[]) => {
	const parentIds = Array.from(
		new Set(records.flatMap((record) => (record.parentId ? [record.parentId] : [])))
	);

	if (parentIds.length === 0) {
		return records;
	}

	const parentRows = await db
		.select({
			authorAvatarUrl: users.avatarUrl,
			authorId: artworks.authorId,
			authorNickname: users.nickname,
			id: artworks.id,
			title: artworks.title
		})
		.from(artworks)
		.innerJoin(users, eq(users.id, artworks.authorId))
		.where(and(inArray(artworks.id, parentIds), eq(artworks.isHidden, false)));

	const parentsById = new Map(parentRows.map((row) => [row.id, row]));

	return records.map((record) => {
		if (!record.parentId) return record;

		const parent = parentsById.get(record.parentId);
		if (!parent) return record;

		return {
			...record,
			parentAuthorAvatarUrl: parent.authorAvatarUrl,
			parentAuthorId: parent.authorId,
			parentAuthorNickname: parent.authorNickname,
			parentTitle: parent.title
		};
	});
};

export const artworkReadRepository: ArtworkReadRepository = {
	async listRecentArtworks(input: ListRecentArtworksInput) {
		const viewer = defaultViewer(input.viewer);
		const rows = await db
			.select(buildBaseSelect(viewer))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(and(artworkVisibilityWhere(viewer), recentCursorWhere(input.cursor) ?? undefined))
			.orderBy(desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return hydrateDiscoveryParents(rows.map(mapRow));
	},
	async listHotArtworks(input: ListHotArtworksInput) {
		const viewer = defaultViewer(input.viewer);
		const rankingExpression = hotRankingSql(input.now);
		const rows = await db
			.select(buildRankedBaseSelect(viewer, rankingExpression))
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

		return hydrateDiscoveryParents(rows.map(mapRow));
	},
	async listTopArtworks(input: ListTopArtworksInput) {
		const viewer = defaultViewer(input.viewer);
		const rankingExpression = sql<number>`${artworks.score}::double precision`;
		const windowStart = getTopWindowStart(input.now, input.window);
		const rows = await db
			.select(buildRankedBaseSelect(viewer, rankingExpression))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(
				and(
					artworkVisibilityWhere(viewer),
					input.authorId ? eq(artworks.authorId, input.authorId) : undefined,
					windowStart ? gte(artworks.createdAt, windowStart) : undefined,
					rankedCursorWhere(input.cursor, rankingExpression) ?? undefined
				)
			)
			.orderBy(desc(artworks.score), desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return hydrateDiscoveryParents(rows.map(mapRow));
	},
	async findArtworkDetailById(id, viewer) {
		const activeViewer = defaultViewer(viewer);
		const row = await db
			.select(buildBaseSelect(activeViewer))
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
				isNsfw: artworks.isNsfw,
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
	async listModerationQueue(input: ListModerationQueueInput) {
		const [artworkRows, commentRows] = await Promise.all([
			db
				.select({
					artworkId: artworks.id,
					authorId: artworks.authorId,
					authorNickname: users.nickname,
					contentSummary: artworks.title,
					isHidden: artworks.isHidden,
					reportCount: count(contentReports.id)
				})
				.from(contentReports)
				.innerJoin(artworks, eq(artworks.id, contentReports.artworkId))
				.innerJoin(users, eq(users.id, artworks.authorId))
				.where(and(isNotNull(contentReports.artworkId), eq(contentReports.status, 'pending')))
				.groupBy(artworks.id, users.id)
				.having(gt(count(contentReports.id), 0)),

			db
				.select({
					artworkId: artworkComments.artworkId,
					authorId: artworkComments.authorId,
					authorNickname: users.nickname,
					commentId: artworkComments.id,
					contentSummary: artworkComments.body,
					isHidden: artworkComments.isHidden,
					reportCount: count(contentReports.id)
				})
				.from(contentReports)
				.innerJoin(artworkComments, eq(artworkComments.id, contentReports.commentId))
				.innerJoin(users, eq(users.id, artworkComments.authorId))
				.where(and(isNotNull(contentReports.commentId), eq(contentReports.status, 'pending')))
				.groupBy(artworkComments.id, users.id)
				.having(gt(count(contentReports.id), 0))
		]);

		const allItems: ModerationQueueItem[] = [
			...artworkRows.map((row) => ({
				artworkId: row.artworkId,
				authorId: row.authorId,
				authorNickname: row.authorNickname,
				commentId: null,
				contentSummary: row.contentSummary,
				isHidden: row.isHidden,
				reportCount: row.reportCount,
				targetType: 'artwork' as const
			})),
			...commentRows.map((row) => ({
				artworkId: row.artworkId,
				authorId: row.authorId,
				authorNickname: row.authorNickname,
				commentId: row.commentId,
				contentSummary: row.contentSummary,
				isHidden: row.isHidden,
				reportCount: row.reportCount,
				targetType: 'comment' as const
			}))
		];

		allItems.sort((a, b) => {
			if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
			if (a.targetType !== b.targetType) return a.targetType < b.targetType ? -1 : 1;
			const aId = a.commentId ?? a.artworkId;
			const bId = b.commentId ?? b.artworkId;
			return aId < bId ? -1 : aId > bId ? 1 : 0;
		});

		const filtered = input.cursor
			? allItems.filter((item) => {
					const cursor = input.cursor!;
					if (item.reportCount !== cursor.reportCount) return item.reportCount < cursor.reportCount;
					if (item.targetType !== cursor.targetType) return item.targetType > cursor.targetType;
					const itemId = item.commentId ?? item.artworkId;
					return itemId > cursor.id;
				})
			: allItems;

		return filtered.slice(0, input.limit);
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
