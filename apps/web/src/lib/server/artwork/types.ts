import type { CanonicalUser } from '$lib/server/auth/types';

export type ArtworkRecord = {
	authorId: string;
	commentCount: number;
	createdAt: Date;
	forkCount: number;
	hiddenAt?: Date | null;
	id: string;
	isHidden?: boolean;
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

export type ArtworkDiscoverySort = 'recent' | 'hot' | 'top';

export type ArtworkDiscoveryTopWindow = 'today' | 'week' | 'all';

export type ArtworkRecentDiscoveryCursor = {
	sort: 'recent';
	createdAt: Date;
	id: string;
};

export type ArtworkRankedDiscoveryCursor =
	| {
			sort: 'hot';
			createdAt: Date;
			id: string;
			rankingValue: number;
			snapshotAt: Date;
	  }
	| {
			sort: 'top';
			createdAt: Date;
			id: string;
			rankingValue: number;
			snapshotAt: Date;
			window: ArtworkDiscoveryTopWindow;
	  };

export type ArtworkDiscoveryCursor = ArtworkRecentDiscoveryCursor | ArtworkRankedDiscoveryCursor;

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
	rankingValue?: number;
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
	hiddenAt?: Date | null;
	id: string;
	isHidden?: boolean;
	updatedAt: Date;
};

export type ArtworkReportReason =
	| 'spam'
	| 'harassment'
	| 'hate'
	| 'sexual_content'
	| 'violence'
	| 'misinformation'
	| 'copyright'
	| 'other';

export type ContentReportRecord = {
	artworkId: string | null;
	commentId: string | null;
	createdAt: Date;
	details: string | null;
	id: string;
	reason: ArtworkReportReason;
	reporterId: string;
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
	cursor: ArtworkRecentDiscoveryCursor | null;
	limit: number;
	viewer?: ArtworkVisibilityActor;
};

export type ListHotArtworksInput = {
	cursor: Extract<ArtworkRankedDiscoveryCursor, { sort: 'hot' }> | null;
	limit: number;
	now: Date;
	viewer?: ArtworkVisibilityActor;
};

export type ListTopArtworksInput = {
	cursor: Extract<ArtworkRankedDiscoveryCursor, { sort: 'top' }> | null;
	limit: number;
	now: Date;
	viewer?: ArtworkVisibilityActor;
	window: ArtworkDiscoveryTopWindow;
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

export type CreateContentReportInput = Omit<ContentReportRecord, 'updatedAt'> & {
	updatedAt: Date;
};

export type HiddenStateUpdate = {
	hiddenAt: Date | null;
	isHidden: boolean;
	updatedAt: Date;
};

export type ArtworkVisibilityActor = {
	isModerator: boolean;
	userId: string | null;
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
	createContentReport(input: CreateContentReportInput): Promise<ContentReportRecord>;
	createEngagementRateLimit(
		input: CreateEngagementRateLimitInput
	): Promise<ArtworkEngagementRateLimitRecord>;
	createPublishRateLimit(input: CreatePublishRateLimitInput): Promise<PublishRateLimitRecord>;
	deleteArtwork(id: string): Promise<ArtworkRecord | null>;
	deleteComment(id: string, updatedAt: Date): Promise<ArtworkCommentRecord | null>;
	findArtworkReportCount(artworkId: string): Promise<number>;
	findCommentById(id: string): Promise<ArtworkCommentRecord | null>;
	findCommentReportCount(commentId: string): Promise<number>;
	findArtworkById(id: string): Promise<ArtworkRecord | null>;
	findChildForksByParentId(parentId: string): Promise<ArtworkRecord[]>;
	findEngagementRateLimit(
		kind: ArtworkEngagementRateLimitKind,
		actorKey: string
	): Promise<ArtworkEngagementRateLimitRecord | null>;
	findPublishRateLimit(actorKey: string): Promise<PublishRateLimitRecord | null>;
	findVoteByArtworkAndUser(artworkId: string, userId: string): Promise<ArtworkVoteRecord | null>;
	listCommentsByArtworkId(
		artworkId: string,
		viewer?: ArtworkVisibilityActor
	): Promise<ArtworkCommentView[]>;
	removeVote(
		artworkId: string,
		userId: string,
		updatedAt: Date
	): Promise<ArtworkVoteRemovalResult | null>;
	setArtworkHiddenState(id: string, input: HiddenStateUpdate): Promise<ArtworkRecord | null>;
	setCommentHiddenState(id: string, input: HiddenStateUpdate): Promise<ArtworkCommentRecord | null>;
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
	findArtworkDetailById(
		id: string,
		viewer?: ArtworkVisibilityActor
	): Promise<ArtworkReadRecord | null>;
	findArtworkMediaById(
		id: string,
		viewer?: ArtworkVisibilityActor
	): Promise<Pick<ArtworkRecord, 'id' | 'mediaContentType' | 'storageKey'> | null>;
	listArtworkCommentsByArtworkId(
		artworkId: string,
		viewer?: ArtworkVisibilityActor
	): Promise<ArtworkCommentView[]>;
	listHotArtworks(input: ListHotArtworksInput): Promise<ArtworkReadRecord[]>;
	listRecentArtworks(input: ListRecentArtworksInput): Promise<ArtworkReadRecord[]>;
	listTopArtworks(input: ListTopArtworksInput): Promise<ArtworkReadRecord[]>;
};

export type ArtworkActorContext = {
	ipAddress: string | null;
	user: CanonicalUser;
};
