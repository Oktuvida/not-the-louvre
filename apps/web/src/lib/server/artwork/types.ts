import type { CanonicalUser } from '$lib/server/auth/types';

export type ArtworkRecord = {
	authorId: string;
	commentCount: number;
	createdAt: Date;
	forkCount: number;
	id: string;
	mediaContentType: string;
	mediaSizeBytes: number;
	parentId: string | null;
	score: number;
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
	commentCount: number;
	createdAt: Date;
	forkCount: number;
	id: string;
	lineage: ArtworkLineageSummary;
	mediaUrl: string;
	score: number;
	title: string;
};

export type ArtworkLineageParentSummary = {
	author: ArtworkAuthorSummary;
	id: string;
	title: string;
};

export type ArtworkLineageSummary = {
	isFork: boolean;
	parent: ArtworkLineageParentSummary | null;
	parentStatus: 'available' | 'deleted' | 'none';
};

export type ArtworkChildForkSummary = {
	author: ArtworkAuthorSummary;
	createdAt: Date;
	id: string;
	mediaUrl: string;
	title: string;
};

export type ArtworkDetail = ArtworkFeedCard & {
	childForks: ArtworkChildForkSummary[];
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
	childForks?: Array<{
		authorAvatarUrl: string | null;
		authorId: string;
		authorNickname: string;
		createdAt: Date;
		id: string;
		title: string;
	}>;
	parentAuthorAvatarUrl?: string | null;
	parentAuthorId?: string | null;
	parentAuthorNickname?: string | null;
	parentTitle?: string | null;
};

export type ArtworkVoteValue = 'down' | 'up';

export type ArtworkVoteRecord = {
	artworkId: string;
	createdAt: Date;
	id: string;
	updatedAt: Date;
	userId: string;
	value: ArtworkVoteValue;
};

export type ArtworkCommentRecord = {
	authorId: string;
	artworkId: string;
	body: string;
	createdAt: Date;
	id: string;
	updatedAt: Date;
};

export type ArtworkCommentView = {
	author: ArtworkAuthorSummary;
	artworkId: string;
	body: string;
	createdAt: Date;
	id: string;
	updatedAt: Date;
};

export type ArtworkEngagementRateLimitKind = 'comment' | 'vote';

export type ArtworkEngagementRateLimitRecord = {
	attemptCount: number;
	actorKey: string;
	blockedUntil: Date | null;
	createdAt: Date;
	id: string;
	kind: ArtworkEngagementRateLimitKind;
	lastAttemptAt: Date;
	updatedAt: Date;
	windowStartedAt: Date;
};

export type ArtworkVoteMutationResult = {
	artwork: ArtworkRecord;
	vote: ArtworkVoteRecord;
};

export type ArtworkVoteRemovalResult = {
	artwork: ArtworkRecord;
	removed: ArtworkVoteRecord | null;
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

export type CreateArtworkVoteInput = Omit<ArtworkVoteRecord, 'updatedAt'> & {
	updatedAt: Date;
};

export type CreateArtworkCommentInput = Omit<ArtworkCommentRecord, 'updatedAt'> & {
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

export type CreateEngagementRateLimitInput = Omit<
	ArtworkEngagementRateLimitRecord,
	'createdAt' | 'updatedAt'
> & {
	createdAt: Date;
	updatedAt: Date;
};

export type UpdateEngagementRateLimitInput = Partial<
	Pick<
		ArtworkEngagementRateLimitRecord,
		'attemptCount' | 'blockedUntil' | 'lastAttemptAt' | 'windowStartedAt'
	>
> & {
	updatedAt: Date;
};

export type ArtworkRepository = {
	createComment(input: CreateArtworkCommentInput): Promise<ArtworkCommentView | null>;
	createArtwork(input: CreateArtworkInput): Promise<ArtworkRecord>;
	createEngagementRateLimit(
		input: CreateEngagementRateLimitInput
	): Promise<ArtworkEngagementRateLimitRecord>;
	createPublishRateLimit(input: CreatePublishRateLimitInput): Promise<PublishRateLimitRecord>;
	deleteArtwork(id: string): Promise<ArtworkRecord | null>;
	deleteComment(id: string, updatedAt: Date): Promise<ArtworkCommentRecord | null>;
	findCommentById(id: string): Promise<ArtworkCommentRecord | null>;
	findArtworkById(id: string): Promise<ArtworkRecord | null>;
	findChildForksByParentId(parentId: string): Promise<ArtworkRecord[]>;
	findEngagementRateLimit(
		kind: ArtworkEngagementRateLimitKind,
		actorKey: string
	): Promise<ArtworkEngagementRateLimitRecord | null>;
	findPublishRateLimit(actorKey: string): Promise<PublishRateLimitRecord | null>;
	findVoteByArtworkAndUser(artworkId: string, userId: string): Promise<ArtworkVoteRecord | null>;
	listCommentsByArtworkId(artworkId: string): Promise<ArtworkCommentView[]>;
	removeVote(
		artworkId: string,
		userId: string,
		updatedAt: Date
	): Promise<ArtworkVoteRemovalResult | null>;
	upsertVote(input: CreateArtworkVoteInput): Promise<ArtworkVoteMutationResult | null>;
	updateArtworkTitle(id: string, title: string, updatedAt: Date): Promise<ArtworkRecord | null>;
	updateEngagementRateLimit(
		id: string,
		input: UpdateEngagementRateLimitInput
	): Promise<ArtworkEngagementRateLimitRecord>;
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
