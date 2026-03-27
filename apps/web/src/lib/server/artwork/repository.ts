import { and, asc, count, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	artworkComments,
	artworkEngagementRateLimits,
	artworkPublishRateLimits,
	contentReports,
	artworkVotes,
	artworks,
	users
} from '$lib/server/db/schema';
import type {
	ArtworkCommentRecord,
	ArtworkCommentView,
	ContentReportRecord,
	ArtworkRecord,
	ArtworkRepository,
	ArtworkVoteMutationResult,
	ArtworkVoteRecord,
	CreatePublishRateLimitInput,
	CreateArtworkCommentInput,
	CreateContentReportInput,
	CreateArtworkVoteInput,
	CreateEngagementRateLimitInput,
	HiddenStateUpdate,
	UpdateEngagementRateLimitInput,
	UpdatePublishRateLimitInput
} from './types';

export const artworkRepository: ArtworkRepository = {
	async findArtworkById(id) {
		return (await db.query.artworks.findFirst({ where: eq(artworks.id, id) })) ?? null;
	},
	async createArtwork(input) {
		return db.transaction(async (tx) => {
			const [record] = await tx.insert(artworks).values(input).returning();

			if (input.parentId) {
				await tx
					.update(artworks)
					.set({
						forkCount: sql`${artworks.forkCount} + 1`,
						updatedAt: input.updatedAt
					})
					.where(eq(artworks.id, input.parentId));
			}

			return record as ArtworkRecord;
		});
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
			.returning();

		return (record as ArtworkRecord | undefined) ?? null;
	},
	async deleteArtwork(id) {
		return db.transaction(async (tx) => {
			const artwork = (await tx.query.artworks.findFirst({ where: eq(artworks.id, id) })) ?? null;
			if (!artwork) return null;

			const [record] = await tx.delete(artworks).where(eq(artworks.id, id)).returning();

			if (artwork.parentId) {
				await tx
					.update(artworks)
					.set({
						forkCount: sql`greatest(0, ${artworks.forkCount} - 1)`,
						updatedAt: artwork.updatedAt
					})
					.where(eq(artworks.id, artwork.parentId));
			}

			return (record as ArtworkRecord | undefined) ?? null;
		});
	},
	async findChildForksByParentId(parentId) {
		return db.query.artworks.findMany({ where: eq(artworks.parentId, parentId) });
	},
	async findArtworkReportCount(artworkId) {
		const [result] = await db
			.select({ value: count() })
			.from(contentReports)
			.where(eq(contentReports.artworkId, artworkId));

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
			const artwork =
				(await tx.query.artworks.findFirst({ where: eq(artworks.id, input.artworkId) })) ?? null;
			if (!artwork) return null;

			const previousDelta = existing ? (existing.value === 'up' ? 1 : -1) : 0;
			const nextDelta = input.value === 'up' ? 1 : -1;

			const [vote] = existing
				? await tx
						.update(artworkVotes)
						.set({ updatedAt: input.updatedAt, value: input.value })
						.where(eq(artworkVotes.id, existing.id))
						.returning()
				: await tx.insert(artworkVotes).values(input).returning();

			const [updatedArtwork] = await tx
				.update(artworks)
				.set({ score: artwork.score - previousDelta + nextDelta, updatedAt: input.updatedAt })
				.where(eq(artworks.id, input.artworkId))
				.returning();

			return {
				artwork: updatedArtwork as ArtworkRecord,
				vote: vote as ArtworkVoteRecord
			} satisfies ArtworkVoteMutationResult;
		});
	},
	async removeVote(artworkId, userId, updatedAt) {
		return db.transaction(async (tx) => {
			const artwork =
				(await tx.query.artworks.findFirst({ where: eq(artworks.id, artworkId) })) ?? null;
			if (!artwork) return null;

			const existing =
				(await tx.query.artworkVotes.findFirst({
					where: and(eq(artworkVotes.artworkId, artworkId), eq(artworkVotes.userId, userId))
				})) ?? null;

			if (!existing) {
				return { artwork: artwork as ArtworkRecord, removed: null };
			}

			await tx.delete(artworkVotes).where(eq(artworkVotes.id, existing.id));
			const [updatedArtwork] = await tx
				.update(artworks)
				.set({ score: artwork.score - (existing.value === 'up' ? 1 : -1), updatedAt })
				.where(eq(artworks.id, artworkId))
				.returning();

			return {
				artwork: updatedArtwork as ArtworkRecord,
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
			await tx
				.update(artworks)
				.set({ commentCount: artwork.commentCount + 1, updatedAt: input.updatedAt })
				.where(eq(artworks.id, input.artworkId));

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
			.where(eq(contentReports.commentId, commentId));

		return result?.value ?? 0;
	},
	async deleteComment(id, updatedAt) {
		return db.transaction(async (tx) => {
			const comment =
				(await tx.query.artworkComments.findFirst({ where: eq(artworkComments.id, id) })) ?? null;
			if (!comment) return null;

			const artwork =
				(await tx.query.artworks.findFirst({ where: eq(artworks.id, comment.artworkId) })) ?? null;
			if (!artwork) return null;

			const [deleted] = await tx
				.delete(artworkComments)
				.where(eq(artworkComments.id, id))
				.returning();
			await tx
				.update(artworks)
				.set({ commentCount: Math.max(0, artwork.commentCount - 1), updatedAt })
				.where(eq(artworks.id, comment.artworkId));

			return deleted as ArtworkCommentRecord;
		});
	},
	async setArtworkHiddenState(id: string, input: HiddenStateUpdate) {
		const [record] = await db.update(artworks).set(input).where(eq(artworks.id, id)).returning();

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
	async findEngagementRateLimit(kind, actorKey) {
		return (
			(await db.query.artworkEngagementRateLimits.findFirst({
				where: and(
					eq(artworkEngagementRateLimits.kind, kind),
					eq(artworkEngagementRateLimits.actorKey, actorKey)
				)
			})) ?? null
		);
	},
	async createEngagementRateLimit(input: CreateEngagementRateLimitInput) {
		const [record] = await db.insert(artworkEngagementRateLimits).values(input).returning();
		return record;
	},
	async updateEngagementRateLimit(id: string, input: UpdateEngagementRateLimitInput) {
		const [record] = await db
			.update(artworkEngagementRateLimits)
			.set(input)
			.where(eq(artworkEngagementRateLimits.id, id))
			.returning();

		return record;
	},
	async findPublishRateLimit(actorKey) {
		return (
			(await db.query.artworkPublishRateLimits.findFirst({
				where: eq(artworkPublishRateLimits.actorKey, actorKey)
			})) ?? null
		);
	},
	async createPublishRateLimit(input: CreatePublishRateLimitInput) {
		const [record] = await db.insert(artworkPublishRateLimits).values(input).returning();
		return record;
	},
	async updatePublishRateLimit(id: string, input: UpdatePublishRateLimitInput) {
		const [record] = await db
			.update(artworkPublishRateLimits)
			.set(input)
			.where(eq(artworkPublishRateLimits.id, id))
			.returning();

		return record;
	}
};
