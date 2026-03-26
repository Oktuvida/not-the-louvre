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

export type ArtworkAuthorSummary = {
	avatarUrl: string | null;
	id: string;
	nickname: string;
};

export type ArtworkFeedCard = {
	author: ArtworkAuthorSummary;
	createdAt: Date;
	id: string;
	mediaUrl: string;
	title: string;
};

export type ArtworkDetail = ArtworkFeedCard & {
	mediaContentType: string;
	mediaSizeBytes: number;
	updatedAt: Date;
};

export type ArtworkDiscoverySort = 'recent';

export type ArtworkDiscoveryCursor = {
	createdAt: Date;
	id: string;
};

export type ArtworkDiscoveryPage = {
	items: ArtworkFeedCard[];
	pageInfo: {
		hasMore: boolean;
		nextCursor: string | null;
	};
	sort: ArtworkDiscoverySort;
};

export type ArtworkReadRecord = ArtworkRecord & {
	authorAvatarUrl: string | null;
	authorNickname: string;
};

export type ListRecentArtworksInput = {
	cursor: ArtworkDiscoveryCursor | null;
	limit: number;
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

export type ArtworkReadRepository = {
	findArtworkDetailById(id: string): Promise<ArtworkReadRecord | null>;
	findArtworkMediaById(
		id: string
	): Promise<Pick<ArtworkRecord, 'id' | 'mediaContentType' | 'storageKey'> | null>;
	listRecentArtworks(input: ListRecentArtworksInput): Promise<ArtworkReadRecord[]>;
};

export type ArtworkActorContext = {
	ipAddress: string | null;
	user: CanonicalUser;
};
