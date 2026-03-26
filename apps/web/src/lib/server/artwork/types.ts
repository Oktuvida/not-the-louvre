import type { CanonicalUser } from '$lib/server/auth/types';

export type ArtworkRecord = {
	authorId: string;
	createdAt: Date;
	id: string;
	mediaContentType: string;
	mediaSizeBytes: number;
	storageKey: string;
	title: string;
	updatedAt: Date;
};

export type PublishRateLimitRecord = {
	attemptCount: number;
	actorKey: string;
	blockedUntil: Date | null;
	createdAt: Date;
	id: string;
	lastAttemptAt: Date;
	updatedAt: Date;
	windowStartedAt: Date;
};

export type ArtworkStorage = {
	delete(key: string): Promise<void>;
	upload(key: string, file: File): Promise<void>;
};

export type CreateArtworkInput = Omit<ArtworkRecord, 'createdAt' | 'updatedAt'> & {
	createdAt: Date;
	updatedAt: Date;
};

export type CreatePublishRateLimitInput = Omit<
	PublishRateLimitRecord,
	'createdAt' | 'updatedAt'
> & {
	createdAt: Date;
	updatedAt: Date;
};

export type UpdatePublishRateLimitInput = Partial<
	Pick<
		PublishRateLimitRecord,
		'attemptCount' | 'blockedUntil' | 'lastAttemptAt' | 'windowStartedAt'
	>
> & {
	updatedAt: Date;
};

export type ArtworkRepository = {
	createArtwork(input: CreateArtworkInput): Promise<ArtworkRecord>;
	createPublishRateLimit(input: CreatePublishRateLimitInput): Promise<PublishRateLimitRecord>;
	deleteArtwork(id: string): Promise<ArtworkRecord | null>;
	findArtworkById(id: string): Promise<ArtworkRecord | null>;
	findPublishRateLimit(actorKey: string): Promise<PublishRateLimitRecord | null>;
	updateArtworkTitle(id: string, title: string, updatedAt: Date): Promise<ArtworkRecord | null>;
	updatePublishRateLimit(
		id: string,
		input: UpdatePublishRateLimitInput
	): Promise<PublishRateLimitRecord>;
};

export type ArtworkActorContext = {
	ipAddress: string | null;
	user: CanonicalUser;
};
