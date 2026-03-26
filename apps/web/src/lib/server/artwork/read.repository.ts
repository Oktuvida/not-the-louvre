import { and, desc, eq, lt, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artworks, users } from '$lib/server/db/schema';
import type {
	ArtworkDiscoveryCursor,
	ArtworkReadRecord,
	ArtworkReadRepository,
	ListRecentArtworksInput
} from './types';

const recentCursorWhere = (cursor: ArtworkDiscoveryCursor | null) => {
	if (!cursor) return undefined;

	return or(
		lt(artworks.createdAt, cursor.createdAt),
		and(eq(artworks.createdAt, cursor.createdAt), lt(artworks.id, cursor.id))
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
	updatedAt: row.updatedAt
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
