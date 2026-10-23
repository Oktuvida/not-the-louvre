import { and, asc, count, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import {
	artworkComments,
	artworkEngagementRateLimits,
	artworkPublishRateLimits,
	contentReports,
	artworkVotes,
	artworks,
	users
} from '#lib/server/db/schema.js';
import {
	rateLimitAttemptSet,
	rateLimitFirstAttemptBlockedUntil
} from '#lib/server/db/rate-limit.js';
import type {
	ArtworkCommentRecord,
	ArtworkCommentView,
	ArtworkEngagementRateLimitRecord,
	ContentReportRecord,
	ArtworkRecord,
	ArtworkRepository,
	ArtworkVoteMutationResult,
	ArtworkVoteRecord,
	ArtworkVoteSummary,
	CreateArtworkCommentInput,
	CreateContentReportInput,
	CreateArtworkVoteInput,
	HiddenStateUpdate,
	PublishRateLimitRecord,
	RecordEngagementRateLimitAttemptInput,
	RecordRateLimitAttemptInput,
	ResolveContentReportsInput
} from './types';

// Every `artworks` column except `drawing_document`. The document can be
// hundreds of KiB and no writer's caller reads it back, so RETURNING it only
// drags it across the pooler again — the exact traffic the chunked write
// exists to avoid.
const artworkRecordProjection = {
	authorId: artworks.authorId,
	commentCount: artworks.commentCount,
	createdAt: artworks.createdAt,
	drawingVersion: artworks.drawingVersion,
	forkCount: artworks.forkCount,
	hiddenAt: artworks.hiddenAt,
	id: artworks.id,
	isHidden: artworks.isHidden,
	isNsfw: artworks.isNsfw,
	mediaContentType: artworks.mediaContentType,
	mediaPlaceholder: artworks.mediaPlaceholder,
	mediaSizeBytes: artworks.mediaSizeBytes,
	nsfwLabeledAt: artworks.nsfwLabeledAt,
	nsfwSource: artworks.nsfwSource,
	parentId: artworks.parentId,
	score: artworks.score,
	storageKey: artworks.storageKey,
	title: artworks.title,
	updatedAt: artworks.updatedAt
};

// The vote routes serialise this straight to the browser and the client reads
// only `score`, so the transaction reads back five columns instead of the
// whole row (three times, document included, before this narrowing).
const artworkVoteSummaryProjection = {
	commentCount: artworks.commentCount,
	forkCount: artworks.forkCount,
	id: artworks.id,
	score: artworks.score,
	updatedAt: artworks.updatedAt
};

export const artworkRepository: ArtworkRepository = {
	async findArtworkById(id) {
		return (await db.query.artworks.findFirst({ where: eq(artworks.id, id) })) ?? null;
	},
	async createArtwork(input) {
		const [record] = await db.insert(artworks).values(input).returning(artworkRecordProjection);
		return record as ArtworkRecord;
	},
	// The expected-length guard makes each append exactly-once under ambiguous
	// connection failures: a reissued chunk whose first delivery committed
	// matches zero rows instead of double-appending.
	async appendArtworkDrawingDocumentChunk(id, chunk, expectedLength, updatedAt) {
		const updated = await db
			.update(artworks)
			.set({
				drawingDocument: sql`coalesce(${artworks.drawingDocument}, '') || ${chunk}`,
				updatedAt
			})
			.where(
				and(
					eq(artworks.id, id),
					sql`coalesce(length(${artworks.drawingDocument}), 0) = ${expectedLength}`
				)
			)
			.returning({ id: artworks.id });

		return updated.length > 0;
	},
	async finalizeArtworkDrawingDocument(id, version, expectedTotalLength, updatedAt) {
		const [record] = await db
			.update(artworks)
			.set({ drawingVersion: version, updatedAt })
			.where(
				and(eq(artworks.id, id), sql`length(${artworks.drawingDocument}) = ${expectedTotalLength}`)
			)
			.returning(artworkRecordProjection);

		return (record as ArtworkRecord | undefined) ?? null;
	},
	async findArtworkDrawingDocumentLength(id) {
		const [row] = await db
			.select({ length: sql<number>`coalesce(length(${artworks.drawingDocument}), 0)` })
			.from(artworks)
			.where(eq(artworks.id, id));

		return row ? Number(row.length) : null;
	},
	async createContentReport(input: CreateContentReportInput) {
		const [record] = await db.insert(contentReports).values(input).returning();
		return record as ContentReportRecord;
	},
	async updateArtworkTitle(id, title, updatedAt) {
		const [record] = await db
			.update(artworks)
			.set({ title, updatedAt })
			.where(eq(artworks.id, id))
			.returning(artworkRecordProjection);

		return (record as ArtworkRecord | undefined) ?? null;
	},
	async deleteArtwork(id) {
		const [record] = await db
			.delete(artworks)
			.where(eq(artworks.id, id))
			.returning(artworkRecordProjection);
		return (record as ArtworkRecord | undefined) ?? null;
	},
	async findChildForksByParentId(parentId) {
		return db.query.artworks.findMany({ where: eq(artworks.parentId, parentId) });
	},
	async findArtworkReportCount(artworkId) {
		const [result] = await db
			.select({ value: count() })
			.from(contentReports)
			.where(and(eq(contentReports.artworkId, artworkId), eq(contentReports.status, 'pending')));

		return result?.value ?? 0;
	},
	async findVoteByArtworkAndUser(artworkId, userId) {
		return (
			(await db.query.artworkVotes.findFirst({
				where: and(eq(artworkVotes.artworkId, artworkId), eq(artworkVotes.userId, userId))
			})) ?? null
		);
	},
	async upsertVote(input: CreateArtworkVoteInput) {
		return db.transaction(async (tx) => {
			const existing =
				(await tx.query.artworkVotes.findFirst({
					where: and(
						eq(artworkVotes.artworkId, input.artworkId),
						eq(artworkVotes.userId, input.userId)
					)
				})) ?? null;
			// Existence check stays, but reads one column instead of the whole row:
			// without it the vote insert would raise an FK violation and turn a
			// clean 404 into a 500.
			const [artwork] = await tx
				.select({ id: artworks.id })
				.from(artworks)
				.where(eq(artworks.id, input.artworkId));
			if (!artwork) return null;

			const [vote] = existing
				? await tx
						.update(artworkVotes)
						.set({ updatedAt: input.updatedAt, value: input.value })
						.where(eq(artworkVotes.id, existing.id))
						.returning()
				: await tx.insert(artworkVotes).values(input).returning();

			// `score` is maintained by sync_artwork_score_trigger, so the count has
			// to be re-read — but only the five columns the callers use.
			const [updatedArtwork] = await tx
				.select(artworkVoteSummaryProjection)
				.from(artworks)
				.where(eq(artworks.id, input.artworkId));
			if (!updatedArtwork) return null;

			return {
				artwork: updatedArtwork as ArtworkVoteSummary,
				vote: vote as ArtworkVoteRecord
			} satisfies ArtworkVoteMutationResult;
		});
	},
	async removeVote(artworkId, userId) {
		return db.transaction(async (tx) => {
			const [artwork] = await tx
				.select(artworkVoteSummaryProjection)
				.from(artworks)
				.where(eq(artworks.id, artworkId));
			if (!artwork) return null;

			const existing =
				(await tx.query.artworkVotes.findFirst({
					where: and(eq(artworkVotes.artworkId, artworkId), eq(artworkVotes.userId, userId))
				})) ?? null;

			if (!existing) {
				return { artwork: artwork as ArtworkVoteSummary, removed: null };
			}

			await tx.delete(artworkVotes).where(eq(artworkVotes.id, existing.id));
			const [updatedArtwork] = await tx
				.select(artworkVoteSummaryProjection)
				.from(artworks)
				.where(eq(artworks.id, artworkId));
			if (!updatedArtwork) return null;

			return {
				artwork: updatedArtwork as ArtworkVoteSummary,
				removed: existing as ArtworkVoteRecord
			};
		});
	},
	async listCommentsByArtworkId(artworkId) {
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
			.where(and(eq(artworkComments.artworkId, artworkId), eq(artworkComments.isHidden, false)))
			.orderBy(asc(artworkComments.createdAt), asc(artworkComments.id));

		return rows.map<ArtworkCommentView>((row) => ({
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
	},
	async createComment(input: CreateArtworkCommentInput) {
		return db.transaction(async (tx) => {
			const artwork =
				(await tx.query.artworks.findFirst({ where: eq(artworks.id, input.artworkId) })) ?? null;
			if (!artwork) return null;

			const author =
				(await tx.query.users.findFirst({ where: eq(users.id, input.authorId) })) ?? null;
			if (!author) return null;

			const [comment] = await tx.insert(artworkComments).values(input).returning();

			return {
				author: {
					avatarUrl: author.avatarUrl,
					id: author.id,
					nickname: author.nickname
				},
				artworkId: comment.artworkId,
				body: comment.body,
				createdAt: comment.createdAt,
				id: comment.id,
				updatedAt: comment.updatedAt
			};
		});
	},
	async findCommentById(id) {
		return (
			(await db.query.artworkComments.findFirst({ where: eq(artworkComments.id, id) })) ?? null
		);
	},
	async findCommentReportCount(commentId) {
		const [result] = await db
			.select({ value: count() })
			.from(contentReports)
			.where(and(eq(contentReports.commentId, commentId), eq(contentReports.status, 'pending')));

		return result?.value ?? 0;
	},
	async resolveArtworkReports(input: ResolveContentReportsInput) {
		const records = await db
			.update(contentReports)
			.set({
				reviewedAt: input.resolvedAt,
				reviewedBy: input.resolvedBy,
				status: input.status,
				updatedAt: input.resolvedAt
			})
			.where(
				and(eq(contentReports.artworkId, input.targetId), eq(contentReports.status, 'pending'))
			)
			.returning({ id: contentReports.id });

		return records.length;
	},
	async resolveCommentReports(input: ResolveContentReportsInput) {
		const records = await db
			.update(contentReports)
			.set({
				reviewedAt: input.resolvedAt,
				reviewedBy: input.resolvedBy,
				status: input.status,
				updatedAt: input.resolvedAt
			})
			.where(
				and(eq(contentReports.commentId, input.targetId), eq(contentReports.status, 'pending'))
			)
			.returning({ id: contentReports.id });

		return records.length;
	},
	async deleteComment(id) {
		return db.transaction(async (tx) => {
			const comment =
				(await tx.query.artworkComments.findFirst({ where: eq(artworkComments.id, id) })) ?? null;
			if (!comment) return null;

			const [deleted] = await tx
				.delete(artworkComments)
				.where(eq(artworkComments.id, id))
				.returning();

			return deleted as ArtworkCommentRecord;
		});
	},
	async setArtworkHiddenState(id: string, input: HiddenStateUpdate) {
		// Keeps isHidden/isNsfw/hiddenAt flowing: ArtworkSafetyActions reads them
		// off the moderation response.
		const [record] = await db
			.update(artworks)
			.set(input)
			.where(eq(artworks.id, id))
			.returning(artworkRecordProjection);

		return (record as ArtworkRecord | undefined) ?? null;
	},
	async updateArtworkModeration(id: string, input) {
		const [record] = await db
			.update(artworks)
			.set(input)
			.where(eq(artworks.id, id))
			.returning(artworkRecordProjection);

		return (record as ArtworkRecord | undefined) ?? null;
	},
	async setCommentHiddenState(id: string, input: HiddenStateUpdate) {
		const [record] = await db
			.update(artworkComments)
			.set(input)
			.where(eq(artworkComments.id, id))
			.returning();

		return (record as ArtworkCommentRecord | undefined) ?? null;
	},
	// One statement per attempt: the insert lands the first attempt and the
	// `do update` counts every later one against the row it is already
	// locking, so two concurrent attempts cannot both read the same count.
	async recordEngagementRateLimitAttempt(input: RecordEngagementRateLimitAttemptInput) {
		const [record] = await db
			.insert(artworkEngagementRateLimits)
			.values({
				actorKey: input.actorKey,
				attemptCount: 1,
				blockedUntil: rateLimitFirstAttemptBlockedUntil(input.policy, input.now),
				createdAt: input.now,
				id: input.id,
				kind: input.kind,
				lastAttemptAt: input.now,
				updatedAt: input.now,
				windowStartedAt: input.now
			})
			.onConflictDoUpdate({
				target: [artworkEngagementRateLimits.kind, artworkEngagementRateLimits.actorKey],
				set: rateLimitAttemptSet(artworkEngagementRateLimits, input.policy)
			})
			.returning();

		return record as ArtworkEngagementRateLimitRecord;
	},
	async findPublishRateLimit(actorKey) {
		return (
			(await db.query.artworkPublishRateLimits.findFirst({
				where: eq(artworkPublishRateLimits.actorKey, actorKey)
			})) ?? null
		);
	},
	async recordPublishRateLimitAttempt(input: RecordRateLimitAttemptInput) {
		const [record] = await db
			.insert(artworkPublishRateLimits)
			.values({
				actorKey: input.actorKey,
				attemptCount: 1,
				blockedUntil: rateLimitFirstAttemptBlockedUntil(input.policy, input.now),
				createdAt: input.now,
				id: input.id,
				lastAttemptAt: input.now,
				updatedAt: input.now,
				windowStartedAt: input.now
			})
			.onConflictDoUpdate({
				target: artworkPublishRateLimits.actorKey,
				set: rateLimitAttemptSet(artworkPublishRateLimits, input.policy)
			})
			.returning();

		return record as PublishRateLimitRecord;
	}
};
