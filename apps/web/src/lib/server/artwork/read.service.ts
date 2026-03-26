import { env } from '$env/dynamic/private';
import { ArtworkFlowError } from './errors';
import { artworkReadRepository } from './read.repository';
import type {
	ArtworkAuthorSummary,
	ArtworkDetail,
	ArtworkDiscoveryCursor,
	ArtworkDiscoveryPage,
	ArtworkDiscoverySort,
	ArtworkFeedCard,
	ArtworkReadRecord,
	ArtworkReadRepository
} from './types';

type ListArtworkDiscoveryInput = {
	cursor?: string | null;
	limit?: number;
	sort: ArtworkDiscoverySort;
};

type ReadServiceDependencies = {
	repository?: ArtworkReadRepository;
};

const DEFAULT_DISCOVERY_LIMIT = 20;
const MAX_DISCOVERY_LIMIT = 50;

const getDependencies = (dependencies: ReadServiceDependencies = {}) => ({
	repository: dependencies.repository ?? artworkReadRepository
});

const toAuthorSummary = (record: ArtworkReadRecord): ArtworkAuthorSummary => ({
	avatarUrl: record.authorAvatarUrl,
	id: record.authorId,
	nickname: record.authorNickname
});

const getMediaBasePath = () => env.PUBLIC_ARTWORK_MEDIA_BASE_PATH || '/api/artworks';

export const getArtworkMediaUrl = (artworkId: string) => `${getMediaBasePath()}/${artworkId}/media`;

const toFeedCard = (record: ArtworkReadRecord): ArtworkFeedCard => ({
	author: toAuthorSummary(record),
	commentCount: record.commentCount,
	createdAt: record.createdAt,
	id: record.id,
	mediaUrl: getArtworkMediaUrl(record.id),
	score: record.score,
	title: record.title
});

const toDetail = (record: ArtworkReadRecord): ArtworkDetail => ({
	...toFeedCard(record),
	mediaContentType: record.mediaContentType,
	mediaSizeBytes: record.mediaSizeBytes,
	updatedAt: record.updatedAt
});

const decodeCursor = (value: string | null | undefined): ArtworkDiscoveryCursor | null => {
	if (!value) return null;

	try {
		const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
			createdAt?: string;
			id?: string;
		};

		if (!parsed.createdAt || !parsed.id) {
			throw new Error('Invalid artwork discovery cursor');
		}

		const createdAt = new Date(parsed.createdAt);
		if (Number.isNaN(createdAt.getTime())) {
			throw new Error('Invalid artwork discovery cursor');
		}

		return { createdAt, id: parsed.id };
	} catch {
		throw new ArtworkFlowError(400, 'Invalid artwork discovery cursor', 'INVALID_CURSOR');
	}
};

const encodeCursor = (record: Pick<ArtworkReadRecord, 'createdAt' | 'id'>) =>
	Buffer.from(
		JSON.stringify({ createdAt: record.createdAt.toISOString(), id: record.id }),
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
	dependencies: ReadServiceDependencies = {}
): Promise<ArtworkDiscoveryPage> => {
	if (input.sort !== 'recent') {
		throw new ArtworkFlowError(400, 'Unsupported artwork discovery sort', 'INVALID_SORT');
	}

	const { repository } = getDependencies(dependencies);
	const cursor = decodeCursor(input.cursor);
	const limit = normalizeLimit(input.limit);
	const records = await repository.listRecentArtworks({ cursor, limit: limit + 1 });
	const hasMore = records.length > limit;
	const visible = hasMore ? records.slice(0, limit) : records;
	const nextCursor =
		hasMore && visible.length > 0 ? encodeCursor(visible[visible.length - 1]!) : null;

	return {
		items: visible.map(toFeedCard),
		pageInfo: {
			hasMore,
			nextCursor
		},
		sort: input.sort
	};
};

export const getArtworkDetail = async (
	artworkId: string,
	dependencies: ReadServiceDependencies = {}
): Promise<ArtworkDetail> => {
	const { repository } = getDependencies(dependencies);
	const record = await repository.findArtworkDetailById(artworkId);

	if (!record) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	return toDetail(record);
};
