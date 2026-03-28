import { and, asc, count, eq } from 'drizzle-orm';
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
	ResolveContentReportsInput,
	UpdateEngagementRateLimitInput,
	UpdatePublishRateLimitInput
} from './types';

export const artworkRepository: ArtworkRepository = {
	async findArtworkById(id) {
		return (await db.query.artworks.findFirst({ where: eq(artworks.id, id) })) ?? null;
	},
	async createArtwork(input) {
		const [record] = await db.insert(artworks).values(input).returning();
		return record as ArtworkRecord;
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
		const [record] = await db.delete(artworks).where(eq(artworks.id, id)).returning();
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
			const artwork =
				(await tx.query.artworks.findFirst({ where: eq(artworks.id, input.artworkId) })) ?? null;
			if (!artwork) return null;

			const [vote] = existing
				? await tx
						.update(artworkVotes)
						.set({ updatedAt: input.updatedAt, value: input.value })
						.where(eq(artworkVotes.id, existing.id))
						.returning()
				: await tx.insert(artworkVotes).values(input).returning();

			const updatedArtwork =
				(await tx.query.artworks.findFirst({ where: eq(artworks.id, input.artworkId) })) ?? null;
			if (!updatedArtwork) return null;

			return {
				artwork: updatedArtwork as ArtworkRecord,
				vote: vote as ArtworkVoteRecord
			} satisfies ArtworkVoteMutationResult;
		});
	},
	async removeVote(artworkId, userId) {
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
			const updatedArtwork =
				(await tx.query.artworks.findFirst({ where: eq(artworks.id, artworkId) })) ?? null;
			if (!updatedArtwork) return null;

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
