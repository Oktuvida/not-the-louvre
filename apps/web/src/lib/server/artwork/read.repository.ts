import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	gte,
	isNotNull,
	lt,
	lte,
	or,
	sql,
	type AnyColumn,
	type SQL,
	type SQLWrapper
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { artworkComments, artworks, contentReports, users } from '$lib/server/db/schema';
import type { ArtworkVoteValue } from '$lib/shared/content/votes';
import type {
	ArtworkDiscoveryCursor,
	ArtworkDiscoveryTopWindow,
	ArtworkReadRecord,
	ArtworkReadRepository,
	ListHotArtworksInput,
	ListModerationQueueInput,
	ListRecentArtworksInput,
	ListTopArtworksInput,
	ModerationQueueCursor,
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

// The keyset predicate compares whatever expression the feed ranks by. The top
// feed hands in the bare `artworks.score` column and casts the cursor value
// instead: a cast on the column side is not sargable, so a btree on score could
// serve the ordering but never the cursor filter.
const rankedCursorWhere = (
	cursor:
		| Extract<ArtworkDiscoveryCursor, { sort: 'hot' }>
		| Extract<ArtworkDiscoveryCursor, { sort: 'top' }>
		| null,
	rankingExpression: SQLWrapper,
	toCursorValue: (rankingValue: number) => SQL | number = (rankingValue) => rankingValue
) => {
	if (!cursor) return undefined;

	const rankingValue = toCursorValue(cursor.rankingValue);

	return or(
		lt(rankingExpression, rankingValue),
		and(
			eq(rankingExpression, rankingValue),
			or(
				lt(artworks.createdAt, cursor.createdAt),
				and(eq(artworks.createdAt, cursor.createdAt), lt(artworks.id, cursor.id))
			)
		)
	);
};

// The discovery feeds render from the media endpoint, never from the drawing
// document, so their select keeps the multi-hundred-KiB documents out of the
// per-row pooler round-trip. Detail reads keep them for the /draw fork loader.
const discoverySelect = {
	id: artworks.id,
	authorId: artworks.authorId,
	title: artworks.title,
	storageKey: artworks.storageKey,
	mediaContentType: artworks.mediaContentType,
	mediaPlaceholder: artworks.mediaPlaceholder,
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

const drawingDocumentSelect = {
	drawingDocument: artworks.drawingDocument,
	drawingVersion: artworks.drawingVersion
};

const parentArtworks = alias(artworks, 'parent_artwork');
const parentAuthors = alias(users, 'parent_author');

// The fork parent rides along on the feed statement instead of a second serial
// round trip. `is_hidden = false` belongs in the join condition, not the WHERE:
// in the WHERE it would collapse the outer join into an inner one and drop
// every fork of a hidden parent out of the feed entirely.
const parentJoinCondition = and(
	eq(parentArtworks.id, artworks.parentId),
	eq(parentArtworks.isHidden, false)
);

const parentAuthorJoinCondition = eq(parentAuthors.id, parentArtworks.authorId);

const parentSelect = {
	parentAuthorAvatarUrl: parentAuthors.avatarUrl,
	parentAuthorId: parentArtworks.authorId,
	parentAuthorNickname: parentAuthors.nickname,
	parentTitle: parentArtworks.title
};

const voteCountSql = (value: ArtworkVoteValue) =>
	sql<number>`coalesce((
		select count(*)::int
		from "app"."artwork_votes" vote
		where vote.artwork_id = ${artworks.id}
			and vote.value = ${sql.raw(`'${value}'::app.artwork_vote_value`)}
	), 0)`;

const viewerVoteSql = (viewer: { isModerator: boolean; userId: string | null }) =>
	viewer.userId
		? sql<ArtworkVoteValue | null>`(
			select vote.value
			from "app"."artwork_votes" vote
			where vote.artwork_id = ${artworks.id}
				and vote.user_id = ${viewer.userId}
			limit 1
		)`
		: sql<null>`null`;

const engagementSelect = (viewer: { isModerator: boolean; userId: string | null }) => ({
	downvotes: voteCountSql('down').as('downvotes'),
	upvotes: voteCountSql('up').as('upvotes'),
	viewerVote: viewerVoteSql(viewer).as('viewerVote')
});

// The multi-hundred-KiB drawing document is only ever read by the /draw fork
// loader, so it stays off every other statement — the detail route nulls it out
// one function later anyway.
const buildDetailSelect = (
	viewer: { isModerator: boolean; userId: string | null },
	options: { withDrawingDocument?: boolean } = {}
) => ({
	...discoverySelect,
	...(options.withDrawingDocument ? drawingDocumentSelect : {}),
	...engagementSelect(viewer)
});

const buildDiscoverySelect = (viewer: { isModerator: boolean; userId: string | null }) => ({
	...discoverySelect,
	...parentSelect,
	...engagementSelect(viewer)
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
	drawingDocument?: string | null;
	drawingVersion?: number | null;
	mediaContentType: string;
	mediaPlaceholder?: string | null;
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
	viewerVote?: ArtworkVoteValue | null;
	rankingValue?: number;
};

const artworkVisibilityWhere = () => eq(artworks.isHidden, false);

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
	drawingDocument: row.drawingDocument ?? null,
	drawingVersion: row.drawingVersion ?? null,
	mediaContentType: row.mediaContentType,
	mediaPlaceholder: row.mediaPlaceholder ?? null,
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

const buildRankedDiscoverySelect = (
	viewer: { isModerator: boolean; userId: string | null },
	rankingExpression: ReturnType<typeof sql<number>>
) => ({
	...buildDiscoverySelect(viewer),
	rankingValue: rankingExpression.as('rankingValue')
});

const moderationQueueReportCount = () => count(contentReports.id);

// Mirrors the (report_count DESC, target_type ASC, id ASC) ordering the service's
// cursor encodes. target_type is constant inside each aggregate, so the branch
// that matches the cursor breaks ties on the id while the other one only has to
// compare report counts — which is what lets both aggregates carry a LIMIT.
const moderationQueueHaving = (
	cursor: ModerationQueueCursor | null,
	targetType: 'artwork' | 'comment',
	idColumn: AnyColumn
) => {
	const reportCount = moderationQueueReportCount();
	const nonEmpty = gt(reportCount, 0);

	if (!cursor) return nonEmpty;

	if (cursor.targetType === targetType) {
		return and(
			nonEmpty,
			or(
				lt(reportCount, cursor.reportCount),
				and(eq(reportCount, cursor.reportCount), gt(idColumn, cursor.id))
			)
		);
	}

	return and(
		nonEmpty,
		targetType > cursor.targetType
			? lte(reportCount, cursor.reportCount)
			: lt(reportCount, cursor.reportCount)
	);
};

export const artworkReadRepository: ArtworkReadRepository = {
	async listRecentArtworks(input: ListRecentArtworksInput) {
		const viewer = defaultViewer(input.viewer);
		const rows = await db
			.select(buildDiscoverySelect(viewer))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.leftJoin(parentArtworks, parentJoinCondition)
			.leftJoin(parentAuthors, parentAuthorJoinCondition)
			.where(
				and(
					artworkVisibilityWhere(),
					input.authorId ? eq(artworks.authorId, input.authorId) : undefined,
					recentCursorWhere(input.cursor) ?? undefined
				)
			)
			.orderBy(desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},
	async listHotArtworks(input: ListHotArtworksInput) {
		const viewer = defaultViewer(input.viewer);
		const rankingExpression = hotRankingSql(input.now);
		const rows = await db
			.select(buildRankedDiscoverySelect(viewer, rankingExpression))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.leftJoin(parentArtworks, parentJoinCondition)
			.leftJoin(parentAuthors, parentAuthorJoinCondition)
			.where(
				and(
					artworkVisibilityWhere(),
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
			.select(buildRankedDiscoverySelect(viewer, rankingExpression))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.leftJoin(parentArtworks, parentJoinCondition)
			.leftJoin(parentAuthors, parentAuthorJoinCondition)
			.where(
				and(
					artworkVisibilityWhere(),
					input.authorId ? eq(artworks.authorId, input.authorId) : undefined,
					windowStart ? gte(artworks.createdAt, windowStart) : undefined,
					rankedCursorWhere(
						input.cursor,
						artworks.score,
						(rankingValue) => sql`${Math.trunc(rankingValue)}::integer`
					) ?? undefined
				)
			)
			.orderBy(desc(artworks.score), desc(artworks.createdAt), desc(artworks.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},
	async findArtworkDetailById(id, viewer, options) {
		const activeViewer = defaultViewer(viewer);
		const row = await db
			.select(buildDetailSelect(activeViewer, options))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.where(and(eq(artworks.id, id), artworkVisibilityWhere()))
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
	async findArtworkMediaById(id) {
		const row = await db
			.select({
				id: artworks.id,
				mediaContentType: artworks.mediaContentType,
				storageKey: artworks.storageKey
			})
			.from(artworks)
			.where(and(eq(artworks.id, id), artworkVisibilityWhere()))
			.limit(1);

		return row[0] ?? null;
	},
	async findRandomArtwork(viewer) {
		const activeViewer = defaultViewer(viewer);
		// Draw the id on its own first. Sorting by random() has to read every
		// visible row whatever the projection is, so keeping the tuple narrow
		// means the users join and the three correlated vote subqueries are
		// evaluated once, for the winner, instead of once per artwork.
		const drawn = await db
			.select({ id: artworks.id })
			.from(artworks)
			.where(artworkVisibilityWhere())
			.orderBy(sql`random()`)
			.limit(1);

		const drawnId = drawn[0]?.id;
		if (!drawnId) return null;

		const rows = await db
			.select(buildDiscoverySelect(activeViewer))
			.from(artworks)
			.innerJoin(users, eq(users.id, artworks.authorId))
			.leftJoin(parentArtworks, parentJoinCondition)
			.leftJoin(parentAuthors, parentAuthorJoinCondition)
			.where(and(eq(artworks.id, drawnId), artworkVisibilityWhere()))
			.limit(1);

		return rows[0] ? mapRow(rows[0]) : null;
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
					reportCount: moderationQueueReportCount()
				})
				.from(contentReports)
				.innerJoin(artworks, eq(artworks.id, contentReports.artworkId))
				.innerJoin(users, eq(users.id, artworks.authorId))
				.where(and(isNotNull(contentReports.artworkId), eq(contentReports.status, 'pending')))
				.groupBy(artworks.id, users.id)
				.having(moderationQueueHaving(input.cursor, 'artwork', artworks.id))
				.orderBy(desc(moderationQueueReportCount()), asc(artworks.id))
				.limit(input.limit),

			db
				.select({
					artworkId: artworkComments.artworkId,
					authorId: artworkComments.authorId,
					authorNickname: users.nickname,
					commentId: artworkComments.id,
					contentSummary: artworkComments.body,
					isHidden: artworkComments.isHidden,
					reportCount: moderationQueueReportCount()
				})
				.from(contentReports)
				.innerJoin(artworkComments, eq(artworkComments.id, contentReports.commentId))
				.innerJoin(users, eq(users.id, artworkComments.authorId))
				.where(and(isNotNull(contentReports.commentId), eq(contentReports.status, 'pending')))
				.groupBy(artworkComments.id, users.id)
				.having(moderationQueueHaving(input.cursor, 'comment', artworkComments.id))
				.orderBy(desc(moderationQueueReportCount()), asc(artworkComments.id))
				.limit(input.limit)
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

		// Both aggregates are already cursor-filtered and capped at the page
		// size in SQL, and target_type only breaks ties, so the global page is
		// contained in their union: merging at most 2 * limit rows here is
		// enough to restore the exact order the service's cursor encodes.
		allItems.sort((a, b) => {
			if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
			if (a.targetType !== b.targetType) return a.targetType < b.targetType ? -1 : 1;
			const aId = a.commentId ?? a.artworkId;
			const bId = b.commentId ?? b.artworkId;
			return aId < bId ? -1 : aId > bId ? 1 : 0;
		});

		return allItems.slice(0, input.limit);
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
