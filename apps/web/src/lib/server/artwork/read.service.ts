import { env } from '$env/dynamic/private';
import { assertNotBanned } from '$lib/server/auth/guards';
import { ArtworkFlowError } from './errors';
import { artworkReadRepository } from './read.repository';
import type {
	ArtworkAuthorSummary,
	ArtworkChildForkSummary,
	ArtworkDetail,
	ArtworkDiscoveryCursor,
	ArtworkDiscoveryPage,
	ArtworkDiscoverySort,
	ArtworkDiscoveryTopWindow,
	ArtworkFeedCard,
	ArtworkLineageSummary,
	ArtworkReadRecord,
	ArtworkReadRepository,
	ArtworkVisibilityActor,
	ModerationQueueCursor,
	ModerationQueuePage
} from './types';

type ListArtworkDiscoveryInput = {
	authorId?: string | null;
	cursor?: string | null;
	limit?: number;
	sort: ArtworkDiscoverySort;
	window?: string | null;
};

type RequesterContext = {
	user?: {
		id: string;
		role: 'admin' | 'moderator' | 'user';
	} | null;
};

type ReadServiceDependencies = {
	now?: () => Date;
	repository?: ArtworkReadRepository;
};

type ReadContextAndDependencies = RequesterContext & ReadServiceDependencies;

const DEFAULT_DISCOVERY_LIMIT = 20;
const MAX_DISCOVERY_LIMIT = 50;
const SUPPORTED_DISCOVERY_SORTS: ArtworkDiscoverySort[] = ['recent', 'hot', 'top'];
const SUPPORTED_TOP_WINDOWS: ArtworkDiscoveryTopWindow[] = ['today', 'week', 'all'];

const getDependencies = (dependencies: ReadServiceDependencies = {}) => ({
	now: dependencies.now ?? (() => new Date()),
	repository: dependencies.repository ?? artworkReadRepository
});

const toViewer = (context: RequesterContext = {}): ArtworkVisibilityActor => ({
	isModerator: context.user?.role === 'moderator' || context.user?.role === 'admin',
	userId: context.user?.id ?? null
});

const toAuthorSummary = (record: ArtworkReadRecord): ArtworkAuthorSummary => ({
	avatarUrl: resolveAvatarUrl(record.authorId, record.authorAvatarUrl),
	id: record.authorId,
	nickname: record.authorNickname
});

const getMediaBasePath = () => env.PUBLIC_ARTWORK_MEDIA_BASE_PATH || '/api/artworks';

export const getArtworkMediaUrl = (artworkId: string) => `${getMediaBasePath()}/${artworkId}/media`;

const getUserAvatarUrl = (userId: string) => `/api/users/${userId}/avatar`;

const resolveAvatarUrl = (userId: string, storageKey: string | null) =>
	storageKey ? getUserAvatarUrl(userId) : null;

const toLineage = (record: ArtworkReadRecord): ArtworkLineageSummary => {
	if (!record.parentId) {
		return {
			isFork: false,
			parent: null,
			parentStatus: 'none'
		};
	}

	if (record.parentTitle && record.parentAuthorId && record.parentAuthorNickname) {
		return {
			isFork: true,
			parent: {
				author: {
					avatarUrl: resolveAvatarUrl(record.parentAuthorId, record.parentAuthorAvatarUrl ?? null),
					id: record.parentAuthorId,
					nickname: record.parentAuthorNickname
				},
				id: record.parentId,
				title: record.parentTitle
			},
			parentStatus: 'available'
		};
	}

	return {
		isFork: true,
		parent: null,
		parentStatus: 'deleted'
	};
};

const toChildForkSummary = (
	record: NonNullable<ArtworkReadRecord['childForks']>[number]
): ArtworkChildForkSummary => ({
	author: {
		avatarUrl: resolveAvatarUrl(record.authorId, record.authorAvatarUrl),
		id: record.authorId,
		nickname: record.authorNickname
	},
	createdAt: record.createdAt,
	id: record.id,
	isNsfw: record.isNsfw,
	mediaUrl: getArtworkMediaUrl(record.id),
	title: record.title
});

const toFeedCard = (record: ArtworkReadRecord): ArtworkFeedCard => ({
	author: toAuthorSummary(record),
	commentCount: record.commentCount,
	createdAt: record.createdAt,
	downvotes: record.downvotes ?? 0,
	forkCount: record.forkCount,
	id: record.id,
	isNsfw: record.isNsfw,
	lineage: toLineage(record),
	mediaUrl: getArtworkMediaUrl(record.id),
	score: record.score,
	title: record.title,
	upvotes: record.upvotes ?? 0,
	viewerVote: record.viewerVote ?? null
});

const toDetail = (record: ArtworkReadRecord): ArtworkDetail => ({
	...toFeedCard(record),
	childForks: (record.childForks ?? []).map(toChildForkSummary),
	drawingDocument: record.drawingDocument ?? null,
	drawingVersion: record.drawingVersion ?? null,
	mediaContentType: record.mediaContentType,
	mediaSizeBytes: record.mediaSizeBytes,
	updatedAt: record.updatedAt
});

const normalizeSort = (value: string): ArtworkDiscoverySort => {
	if (SUPPORTED_DISCOVERY_SORTS.includes(value as ArtworkDiscoverySort)) {
		return value as ArtworkDiscoverySort;
	}

	throw new ArtworkFlowError(400, 'Unsupported artwork discovery sort', 'INVALID_SORT');
};

const normalizeWindow = (
	sort: ArtworkDiscoverySort,
	value: string | null | undefined
): ArtworkDiscoveryTopWindow | null => {
	if (sort !== 'top') return null;
	if (!value) {
		throw new ArtworkFlowError(400, 'Top feed window is required', 'INVALID_WINDOW');
	}

	if (SUPPORTED_TOP_WINDOWS.includes(value as ArtworkDiscoveryTopWindow)) {
		return value as ArtworkDiscoveryTopWindow;
	}

	throw new ArtworkFlowError(400, 'Unsupported artwork discovery window', 'INVALID_WINDOW');
};

const decodeCursor = (value: string | null | undefined): ArtworkDiscoveryCursor | null => {
	if (!value) return null;

	try {
		const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
			sort?: ArtworkDiscoverySort;
			createdAt?: string;
			id?: string;
			rankingValue?: number;
			snapshotAt?: string;
			window?: ArtworkDiscoveryTopWindow;
		};

		if (!parsed.createdAt || !parsed.id || !parsed.sort) {
			throw new Error('Invalid artwork discovery cursor');
		}

		const createdAt = new Date(parsed.createdAt);
		if (Number.isNaN(createdAt.getTime())) {
			throw new Error('Invalid artwork discovery cursor');
		}

		const snapshotAt = parsed.snapshotAt ? new Date(parsed.snapshotAt) : null;
		if (
			(parsed.sort === 'hot' || parsed.sort === 'top') &&
			(!snapshotAt || Number.isNaN(snapshotAt.getTime()))
		) {
			throw new Error('Invalid artwork discovery cursor');
		}

		if (parsed.sort === 'recent') {
			return { createdAt, id: parsed.id, sort: 'recent' };
		}

		if (typeof parsed.rankingValue !== 'number' || Number.isNaN(parsed.rankingValue)) {
			throw new Error('Invalid artwork discovery cursor');
		}

		if (parsed.sort === 'hot') {
			return {
				createdAt,
				id: parsed.id,
				rankingValue: parsed.rankingValue,
				snapshotAt: snapshotAt!,
				sort: 'hot'
			};
		}

		if (parsed.sort === 'top' && parsed.window && SUPPORTED_TOP_WINDOWS.includes(parsed.window)) {
			return {
				createdAt,
				id: parsed.id,
				rankingValue: parsed.rankingValue,
				snapshotAt: snapshotAt!,
				sort: 'top',
				window: parsed.window
			};
		}

		throw new Error('Invalid artwork discovery cursor');
	} catch {
		throw new ArtworkFlowError(400, 'Invalid artwork discovery cursor', 'INVALID_CURSOR');
	}
};

const encodeCursor = (
	record: Pick<ArtworkReadRecord, 'createdAt' | 'id'>,
	options: {
		rankingValue?: number;
		snapshotAt?: Date;
		sort: ArtworkDiscoverySort;
		window?: ArtworkDiscoveryTopWindow | null;
	}
) =>
	Buffer.from(
		JSON.stringify({
			createdAt: record.createdAt.toISOString(),
			id: record.id,
			rankingValue: options.rankingValue,
			snapshotAt: options.snapshotAt?.toISOString(),
			sort: options.sort,
			window: options.window ?? undefined
		}),
		'utf8'
	).toString('base64url');

const normalizeLimit = (value: number | undefined) => {
	if (!value) return DEFAULT_DISCOVERY_LIMIT;
	if (!Number.isInteger(value) || value < 1) {
		throw new ArtworkFlowError(
			400,
			'Artwork discovery limit must be a positive integer',
			'INVALID_LIMIT'
		);
	}

	return Math.min(value, MAX_DISCOVERY_LIMIT);
};

export const listArtworkDiscovery = async (
	input: ListArtworkDiscoveryInput,
	contextAndDependencies: ReadContextAndDependencies = {},
	dependencies: ReadServiceDependencies = {}
): Promise<ArtworkDiscoveryPage> => {
	const { now, repository } = getDependencies({
		now: contextAndDependencies.now ?? dependencies.now,
		repository: contextAndDependencies.repository ?? dependencies.repository
	});
	const viewer = toViewer(contextAndDependencies);
	const sort = normalizeSort(input.sort);
	const window = normalizeWindow(sort, input.window);
	const cursor = decodeCursor(input.cursor);
	if (cursor && cursor.sort !== sort) {
		throw new ArtworkFlowError(400, 'Invalid artwork discovery cursor', 'INVALID_CURSOR');
	}
	if (sort === 'top' && cursor?.sort === 'top' && cursor.window !== window) {
		throw new ArtworkFlowError(400, 'Invalid artwork discovery cursor', 'INVALID_CURSOR');
	}
	const limit = normalizeLimit(input.limit);
	const snapshotAt = cursor?.sort === 'hot' || cursor?.sort === 'top' ? cursor.snapshotAt : now();
	const records =
		sort === 'recent'
			? await repository.listRecentArtworks({
					authorId: input.authorId,
					cursor: cursor?.sort === 'recent' ? cursor : null,
					limit: limit + 1,
					viewer
				})
			: sort === 'hot'
				? await repository.listHotArtworks({
						cursor: cursor?.sort === 'hot' ? cursor : null,
						limit: limit + 1,
						now: snapshotAt,
						viewer
					})
				: await repository.listTopArtworks({
						authorId: input.authorId,
						cursor: cursor?.sort === 'top' ? cursor : null,
						limit: limit + 1,
						now: snapshotAt,
						viewer,
						window: window!
					});
	const hasMore = records.length > limit;
	const visible = hasMore ? records.slice(0, limit) : records;
	const nextCursor =
		hasMore && visible.length > 0
			? encodeCursor(visible[visible.length - 1]!, {
					rankingValue: visible[visible.length - 1]!.rankingValue,
					snapshotAt: sort === 'recent' ? undefined : snapshotAt,
					sort,
					window
				})
			: null;

	return {
		items: visible.map(toFeedCard),
		pageInfo: {
			hasMore,
			nextCursor
		},
		sort
	};
};

export const getArtworkDetail = async (
	artworkId: string,
	contextAndDependencies: ReadContextAndDependencies = {},
	dependencies: ReadServiceDependencies = {}
): Promise<ArtworkDetail> => {
	const { repository } = getDependencies({
		repository: contextAndDependencies.repository ?? dependencies.repository
	});
	const viewer = toViewer(contextAndDependencies);
	const record = await repository.findArtworkDetailById(artworkId, viewer);

	if (!record) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	if (record.isHidden && !viewer.isModerator && record.authorId !== viewer.userId) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	return toDetail(record);
};

export const listArtworkCommentsForViewer = async (
	artworkId: string,
	contextAndDependencies: ReadContextAndDependencies = {},
	dependencies: Readonly<{ repository?: ArtworkReadRepository }> = {}
) => {
	const repository =
		contextAndDependencies.repository ?? dependencies.repository ?? artworkReadRepository;
	const comments = await repository.listArtworkCommentsByArtworkId(
		artworkId,
		toViewer(contextAndDependencies)
	);
	return comments.map((comment) => ({
		...comment,
		author: {
			...comment.author,
			avatarUrl: resolveAvatarUrl(comment.author.id, comment.author.avatarUrl)
		}
	}));
};

type ListModerationQueueInput = {
	cursor?: string | null;
	limit?: number;
};

const DEFAULT_MODERATION_LIMIT = 20;
const MAX_MODERATION_LIMIT = 50;

const decodeModerationCursor = (value: string | null | undefined): ModerationQueueCursor | null => {
	if (!value) return null;

	try {
		const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
			id?: string;
			reportCount?: number;
			targetType?: string;
		};

		if (
			!parsed.id ||
			typeof parsed.reportCount !== 'number' ||
			(parsed.targetType !== 'artwork' && parsed.targetType !== 'comment')
		) {
			throw new Error('Invalid moderation cursor');
		}

		return {
			id: parsed.id,
			reportCount: parsed.reportCount,
			targetType: parsed.targetType
		};
	} catch {
		throw new ArtworkFlowError(400, 'Invalid moderation queue cursor', 'INVALID_CURSOR');
	}
};

const encodeModerationCursor = (cursor: ModerationQueueCursor): string =>
	Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

export const listModerationQueue = async (
	input: ListModerationQueueInput,
	contextAndDependencies: ReadContextAndDependencies = {}
): Promise<ModerationQueuePage> => {
	const user = contextAndDependencies.user;
	if (!user) {
		throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
	}
	assertNotBanned({
		...user,
		isBanned: 'isBanned' in user ? Boolean((user as { isBanned?: boolean }).isBanned) : false
	});

	if (user.role !== 'moderator' && user.role !== 'admin') {
		throw new ArtworkFlowError(403, 'Moderator access required', 'FORBIDDEN');
	}

	const repository = contextAndDependencies.repository ?? artworkReadRepository;

	const limit = !input.limit
		? DEFAULT_MODERATION_LIMIT
		: Math.min(input.limit, MAX_MODERATION_LIMIT);
	const cursor = decodeModerationCursor(input.cursor);

	const items = await repository.listModerationQueue({ cursor, limit: limit + 1 });

	const hasMore = items.length > limit;
	const visible = hasMore ? items.slice(0, limit) : items;
	const last = visible[visible.length - 1];
	const nextCursor =
		hasMore && last
			? encodeModerationCursor({
					id: last.commentId ?? last.artworkId,
					reportCount: last.reportCount,
					targetType: last.targetType
				})
			: null;

	return {
		items: visible,
		pageInfo: { hasMore, nextCursor }
	};
};

export const getArtworkMedia = async (
	artworkId: string,
	contextAndDependencies: ReadContextAndDependencies = {},
	dependencies: Readonly<{ repository?: ArtworkReadRepository }> = {}
) => {
	const repository =
		contextAndDependencies.repository ?? dependencies.repository ?? artworkReadRepository;
	const media = await repository.findArtworkMediaById(artworkId, toViewer(contextAndDependencies));

	if (!media) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	return media;
};
