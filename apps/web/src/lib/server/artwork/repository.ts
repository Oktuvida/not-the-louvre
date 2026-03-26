import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artworkPublishRateLimits, artworks } from '$lib/server/db/schema';
import type {
	ArtworkRecord,
	ArtworkRepository,
	CreatePublishRateLimitInput,
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
