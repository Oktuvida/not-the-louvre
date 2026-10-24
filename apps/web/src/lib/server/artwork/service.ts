import { generateId } from 'better-auth';
import { assertNotBanned } from '#lib/server/auth/guards.js';
import {
	ARTWORK_COMMENT_MAX_LENGTH,
	ARTWORK_COMMENT_RATE_LIMIT,
	ARTWORK_PUBLISH_RATE_LIMIT,
	ARTWORK_VOTE_RATE_LIMIT,
	CONTENT_REPORT_DETAILS_MAX_LENGTH
} from './config';
import { ArtworkFlowError, logArtworkFlowFailure } from './errors';
import { artworkRepository } from './repository';
import { artworkStorage } from './storage';
import { checkTextModeration } from '#lib/server/moderation/service.js';
import { isRateLimitBlocked, type RateLimitPolicy } from '#lib/server/db/rate-limit.js';
import { isArtworkReportReason } from '#lib/shared/content/report-reasons.js';
import { isArtworkVoteValue } from '#lib/shared/content/votes.js';
import { prepareDrawingDocumentForStorage } from '#lib/server/drawing-document/storage.js';
import type {
	ArtworkActorContext,
	ArtworkCommentView,
	ArtworkEngagementRateLimitKind,
	ArtworkRecord,
	ArtworkReportReason,
	ArtworkRepository,
	ArtworkStorage,
	ArtworkVoteMutationResult,
	ArtworkVoteRemovalResult,
	ArtworkVoteSummary,
	ContentReportStatus,
	ArtworkVisibilityActor,
	ArtworkVoteValue
} from './types';
import {
	drawingDocumentStore,
	type DrawingDocumentStore
} from '#lib/server/drawing-document/document-store.js';
import { renderArtworkMedia } from '#lib/server/render/client.js';
import { publishArtworkChange } from '#lib/server/realtime/artwork-topics.js';
import type { ArtworkVoteTotals } from '#lib/shared/artwork/live-change.js';
import { normalizePublishTitle, normalizeUpdatedTitle } from './validation';

type PublishArtworkInput = {
	drawingDocument?: string | null;
	isNsfw?: boolean;
	parentArtworkId?: string | null;
	title?: string | null;
};

type UpdateArtworkTitleInput = {
	artworkId: string;
	title: string;
};

type DeleteArtworkInput = {
	artworkId: string;
};

type ApplyArtworkVoteInput = {
	artworkId: string;
	value: ArtworkVoteValue;
};

type RemoveArtworkVoteInput = {
	artworkId: string;
};

type CreateArtworkCommentInput = {
	artworkId: string;
	body: string;
};

type DeleteArtworkCommentInput = {
	artworkId: string;
	commentId: string;
};

type SubmitContentReportInput = {
	artworkId?: string | null;
	commentId?: string | null;
	details?: string | null;
	reason: string;
};

type ModerateArtworkInput = {
	action: 'clear_nsfw' | 'delete' | 'dismiss' | 'hide' | 'mark_nsfw' | 'unhide';
	artworkId: string;
};

type ModerateCommentInput = {
	action: 'delete' | 'dismiss' | 'hide' | 'unhide';
	artworkId: string;
	commentId: string;
};

type ServiceDependencies = {
	documents?: DrawingDocumentStore;
	generateId?: () => string;
	now?: () => Date;
	randomSuffix?: () => number;
	repository?: ArtworkRepository;
	renderDrawingDocumentMedia?: typeof renderArtworkMedia;
	storage?: ArtworkStorage;
};

const getDependencies = (dependencies: ServiceDependencies = {}) => ({
	documents: dependencies.documents ?? drawingDocumentStore,
	generateId: dependencies.generateId ?? generateId,
	now: dependencies.now ?? (() => new Date()),
	randomSuffix: dependencies.randomSuffix ?? (() => Math.floor(Math.random() * 10000)),
	repository: dependencies.repository ?? artworkRepository,
	renderDrawingDocumentMedia: dependencies.renderDrawingDocumentMedia ?? renderArtworkMedia,
	storage: dependencies.storage ?? artworkStorage
});

// The gallery client renders from the media endpoint; the drawing document
// (up to hundreds of KiB) only serves the server-side /draw fork loader, so it
// stays off the wire while the response keeps its shape. Every HTTP handler
// that serialises an artwork record goes through this.
export const withoutDrawingDocument = <
	T extends { drawingDocument?: string | null; drawingDocumentKey?: string | null }
>(
	artwork: T
) => ({
	...artwork,
	drawingDocument: null,
	drawingDocumentKey: null
});

const requireActor = (context: Partial<ArtworkActorContext>): ArtworkActorContext => {
	if (!context.user) {
		throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
	}
	assertNotBanned(context.user as ArtworkActorContext['user'] & { isBanned: boolean });

	return {
		ipAddress: context.ipAddress ?? null,
		user: context.user
	};
};

const getActorKey = (context: ArtworkActorContext) =>
	`${context.user.id}:${context.ipAddress ?? 'unknown'}`;

const normalizeCommentBody = (body: string) => {
	const trimmed = body.trim();

	if (!trimmed || trimmed.length > ARTWORK_COMMENT_MAX_LENGTH) {
		throw new ArtworkFlowError(
			400,
			`Comment must be between 1 and ${ARTWORK_COMMENT_MAX_LENGTH} characters`,
			'INVALID_COMMENT'
		);
	}

	return trimmed;
};

const normalizeVoteValue = (value: string): ArtworkVoteValue => {
	if (isArtworkVoteValue(value)) {
		return value;
	}

	throw new ArtworkFlowError(400, 'Vote must be either up or down', 'INVALID_VOTE');
};

const toVoteTotals = ({ downvotes, score, upvotes }: ArtworkVoteSummary): ArtworkVoteTotals => ({
	downvotes,
	score,
	upvotes
});

// Artwork limits block for exactly as long as the window they were counted in.
const artworkRateLimitPolicy = (config: {
	maxAttempts: number;
	windowMs: number;
}): RateLimitPolicy => ({
	blockAnchor: 'window-start',
	blockMs: config.windowMs,
	maxAttempts: config.maxAttempts,
	windowMs: config.windowMs
});

// The upsert counts the attempt and decides the block in one statement, so the
// row it returns is what the caller answers with: no read-then-write window
// where two concurrent votes can both slip past the last allowed attempt.
const recordEngagementAttempt = async (
	kind: ArtworkEngagementRateLimitKind,
	context: ArtworkActorContext,
	repository: ArtworkRepository,
	now: Date,
	nextId: () => string,
	config: { maxAttempts: number; windowMs: number },
	message: string
) => {
	const record = await repository.recordEngagementRateLimitAttempt({
		actorKey: getActorKey(context),
		id: nextId(),
		kind,
		now,
		policy: artworkRateLimitPolicy(config)
	});

	if (isRateLimitBlocked(record, now)) {
		throw new ArtworkFlowError(429, message, 'RATE_LIMITED');
	}
};

const assertPublishRateLimit = async (
	context: ArtworkActorContext,
	repository: ArtworkRepository,
	now: Date
) => {
	const record = await repository.findPublishRateLimit(getActorKey(context));

	if (record?.blockedUntil && record.blockedUntil > now) {
		throw new ArtworkFlowError(
			429,
			'Too many publish attempts. Please wait before trying again.',
			'RATE_LIMITED'
		);
	}
};

// Runs after the publish succeeded, so it only counts: `assertPublishRateLimit`
// at the top of `publishArtwork` is the gate that rejects a blocked author, and
// the attempt that trips the limit still completes.
const recordPublishAttempt = async (
	context: ArtworkActorContext,
	repository: ArtworkRepository,
	now: Date,
	generateIdValue: () => string
) => {
	await repository.recordPublishRateLimitAttempt({
		actorKey: getActorKey(context),
		id: generateIdValue(),
		now,
		policy: artworkRateLimitPolicy(ARTWORK_PUBLISH_RATE_LIMIT)
	});
};

const getArtworkOrThrow = async (artworkId: string, repository: ArtworkRepository) => {
	const artwork = await repository.findArtworkById(artworkId);
	if (!artwork) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	return artwork;
};

const assertAuthor = (authorId: string, userId: string) => {
	if (authorId !== userId) {
		throw new ArtworkFlowError(403, 'Only the artwork author can do that', 'FORBIDDEN');
	}
};

const toVisibilityActor = (context: Partial<ArtworkActorContext>): ArtworkVisibilityActor => ({
	isModerator: context.user?.role === 'moderator' || context.user?.role === 'admin',
	userId: context.user?.id ?? null
});

const assertModerator = (context: Partial<ArtworkActorContext>) => {
	const actor = requireActor(context);
	if (actor.user.role !== 'moderator' && actor.user.role !== 'admin') {
		throw new ArtworkFlowError(403, 'Moderator access required', 'FORBIDDEN');
	}

	return actor;
};

const normalizeReportReason = (reason: string): ArtworkReportReason => {
	const normalized = reason.trim();

	if (isArtworkReportReason(normalized)) {
		return normalized;
	}

	throw new ArtworkFlowError(400, 'Unsupported report reason', 'INVALID_REPORT_REASON');
};

const normalizeReportDetails = (details: string | null | undefined) => {
	const trimmed = details?.trim() ?? null;
	if (!trimmed) return null;
	if (trimmed.length > CONTENT_REPORT_DETAILS_MAX_LENGTH) {
		throw new ArtworkFlowError(
			400,
			`Report details must be at most ${CONTENT_REPORT_DETAILS_MAX_LENGTH} characters`,
			'INVALID_REPORT_TARGET'
		);
	}

	return trimmed;
};

const assertExactlyOneReportTarget = (artworkId?: string | null, commentId?: string | null) => {
	const normalizedArtworkId = artworkId?.trim() ? artworkId.trim() : null;
	const normalizedCommentId = commentId?.trim() ? commentId.trim() : null;
	const targetCount = Number(Boolean(normalizedArtworkId)) + Number(Boolean(normalizedCommentId));

	if (targetCount !== 1) {
		throw new ArtworkFlowError(
			400,
			'Report must target exactly one artwork or comment',
			'INVALID_REPORT_TARGET'
		);
	}

	return { artworkId: normalizedArtworkId, commentId: normalizedCommentId };
};

const PENDING_REPORT_UNIQUE_CONSTRAINTS = [
	'content_reports_pending_artwork_reporter_unique',
	'content_reports_pending_comment_reporter_unique'
];

// Drizzle wraps the driver's error in a DrizzleQueryError, so the SQLSTATE and
// the constraint name live on its cause, never on the error the query rejects with.
const isPendingReportUniqueViolation = (error: unknown) => {
	for (let current: unknown = error; current instanceof Error; current = current.cause) {
		const { code, constraint } = current as { code?: unknown; constraint?: unknown };
		if (code === '23505') {
			return (
				typeof constraint === 'string' && PENDING_REPORT_UNIQUE_CONSTRAINTS.includes(constraint)
			);
		}
	}
	return false;
};

const getResolutionStatus = (
	action: ModerateArtworkInput['action'] | ModerateCommentInput['action']
): Exclude<ContentReportStatus, 'pending'> =>
	action === 'hide' || action === 'delete' || action === 'mark_nsfw' ? 'actioned' : 'reviewed';

export const publishArtwork = async (
	input: PublishArtworkInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
) => {
	const actor = requireActor(context);
	const {
		documents,
		generateId: nextId,
		now: getNow,
		randomSuffix,
		repository,
		renderDrawingDocumentMedia,
		storage
	} = getDependencies(dependencies);
	const now = getNow();

	await assertPublishRateLimit(actor, repository, now);

	const title = normalizePublishTitle(input.title, randomSuffix());
	const titleModeration = await checkTextModeration(title, 'artwork_title');
	if (titleModeration.status !== 'allowed') {
		throw new ArtworkFlowError(400, titleModeration.message, 'INVALID_TITLE');
	}

	const parentArtworkId = input.parentArtworkId?.trim() ? input.parentArtworkId.trim() : null;

	if (parentArtworkId) {
		const parentArtwork = await repository.findArtworkById(parentArtworkId);
		if (!parentArtwork) {
			throw new ArtworkFlowError(400, 'Fork parent artwork not found', 'INVALID_FORK_PARENT');
		}
	}

	// An artwork is its strokes: the image is rendered from them, never uploaded.
	const providedDrawingDocument = input.drawingDocument?.trim() ?? '';
	if (!providedDrawingDocument) {
		throw new ArtworkFlowError(400, 'Artwork drawing document is required', 'INVALID_MEDIA_FORMAT');
	}

	const preparedDocument = await prepareDrawingDocumentForStorage(providedDrawingDocument);
	if (preparedDocument.document.kind !== 'artwork') {
		throw new ArtworkFlowError(
			400,
			'Artwork publish requires an artwork drawing document',
			'INVALID_MEDIA_FORMAT'
		);
	}

	const media = await renderDrawingDocumentMedia(preparedDocument.document);

	const artworkId = nextId();
	const extension = media.contentType.replace('image/', '');
	const storageKey = `artworks/${actor.user.id}/${artworkId}.${extension}`;

	// The drawing and its image go to object storage first; the row comes last
	// and names both, so a reader never finds an artwork without its drawing.
	const drawingDocumentKey = await documents.put(preparedDocument.compressed);
	await storage.upload(storageKey, media.file);

	let artwork: ArtworkRecord;
	try {
		artwork = await repository.createArtwork({
			authorId: actor.user.id,
			commentCount: 0,
			createdAt: now,
			drawingDocument: null,
			drawingDocumentKey,
			drawingVersion: preparedDocument.version,
			forkCount: 0,
			id: artworkId,
			isNsfw: Boolean(input.isNsfw),
			mediaContentType: media.contentType,
			mediaSizeBytes: media.sizeBytes,
			nsfwLabeledAt: input.isNsfw ? now : null,
			nsfwSource: input.isNsfw ? 'creator' : null,
			parentId: parentArtworkId,
			score: 0,
			storageKey,
			title,
			updatedAt: now
		});
	} catch (error) {
		// The image belongs to this request alone. The drawing stays: it is named
		// by its content, so another artwork may already share it.
		await storage.delete(storageKey).catch(() => {});

		if (error instanceof ArtworkFlowError) {
			throw error;
		}

		throw new ArtworkFlowError(500, 'Artwork publish failed', 'PUBLISH_FAILED', { cause: error });
	}

	try {
		await recordPublishAttempt(actor, repository, now, nextId);
	} catch (error) {
		logArtworkFlowFailure('publish rate limit record', error);
	}

	return artwork;
};

export const updateArtworkTitle = async (
	input: UpdateArtworkTitleInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
) => {
	const actor = requireActor(context);
	const { now: getNow, repository } = getDependencies(dependencies);
	const artwork = await getArtworkOrThrow(input.artworkId, repository);
	if (artwork.isHidden) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}
	assertAuthor(artwork.authorId, actor.user.id);
	const title = normalizeUpdatedTitle(input.title);
	const titleModeration = await checkTextModeration(title, 'artwork_title');
	if (titleModeration.status !== 'allowed') {
		throw new ArtworkFlowError(400, titleModeration.message, 'INVALID_TITLE');
	}

	const updated = await repository.updateArtworkTitle(artwork.id, title, getNow());

	if (!updated) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	return updated;
};

export const deleteArtwork = async (
	input: DeleteArtworkInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
) => {
	const actor = requireActor(context);
	const { repository, storage } = getDependencies(dependencies);
	const artwork = await getArtworkOrThrow(input.artworkId, repository);
	assertAuthor(artwork.authorId, actor.user.id);

	await storage.delete(artwork.storageKey);
	const deleted = await repository.deleteArtwork(artwork.id);

	if (!deleted) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	return deleted;
};

export const applyArtworkVote = async (
	input: ApplyArtworkVoteInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
): Promise<ArtworkVoteMutationResult> => {
	const actor = requireActor(context);
	const { generateId: nextId, now: getNow, repository } = getDependencies(dependencies);
	const now = getNow();

	// No existence pre-read: `upsertVote` checks inside its transaction and
	// returns null, which maps to the same 404 below. The only shift is that a
	// vote on a deleted artwork now consumes a rate-limit attempt first.
	await recordEngagementAttempt(
		'vote',
		actor,
		repository,
		now,
		nextId,
		ARTWORK_VOTE_RATE_LIMIT,
		'Too many vote attempts. Please wait before trying again.'
	);

	const result = await repository.upsertVote({
		artworkId: input.artworkId,
		createdAt: now,
		id: nextId(),
		updatedAt: now,
		userId: actor.user.id,
		value: normalizeVoteValue(input.value)
	});

	if (!result) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	publishArtworkChange(input.artworkId, { change: 'votes', votes: toVoteTotals(result.artwork) });
	return result;
};

export const removeArtworkVote = async (
	input: RemoveArtworkVoteInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
): Promise<ArtworkVoteRemovalResult> => {
	const actor = requireActor(context);
	const { now: getNow, repository } = getDependencies(dependencies);
	const result = await repository.removeVote(input.artworkId, actor.user.id, getNow());

	if (!result) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	publishArtworkChange(input.artworkId, { change: 'votes', votes: toVoteTotals(result.artwork) });
	return result;
};

export const createArtworkComment = async (
	input: CreateArtworkCommentInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
): Promise<ArtworkCommentView> => {
	const actor = requireActor(context);
	const { generateId: nextId, now: getNow, repository } = getDependencies(dependencies);
	const now = getNow();
	const artwork = await getArtworkOrThrow(input.artworkId, repository);

	await recordEngagementAttempt(
		'comment',
		actor,
		repository,
		now,
		nextId,
		ARTWORK_COMMENT_RATE_LIMIT,
		'Too many comment attempts. Please wait before trying again.'
	);
	const body = normalizeCommentBody(input.body);
	const textModeration = await checkTextModeration(body, 'comment');
	if (textModeration.status !== 'allowed') {
		throw new ArtworkFlowError(400, textModeration.message, 'INVALID_COMMENT');
	}

	const comment = await repository.createComment({
		authorId: actor.user.id,
		artworkId: artwork.id,
		body,
		createdAt: now,
		id: nextId(),
		updatedAt: now
	});

	if (!comment) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	publishArtworkChange(input.artworkId, {
		change: 'comments',
		comment: {
			author: comment.author.nickname,
			id: comment.id,
			text: comment.body,
			timestamp: comment.createdAt.getTime()
		}
	});
	return comment;
};

export const listArtworkComments = async (
	artworkId: string,
	context: Partial<ArtworkActorContext> = {},
	dependencies: Readonly<{ repository?: ArtworkRepository }> = {}
) => {
	if ('repository' in context && !dependencies.repository) {
		dependencies = { repository: (context as { repository?: ArtworkRepository }).repository };
		context = {};
	}
	const repository = dependencies.repository ?? artworkRepository;
	await getArtworkOrThrow(artworkId, repository);
	return repository.listCommentsByArtworkId(artworkId, toVisibilityActor(context));
};

export const deleteArtworkComment = async (
	input: DeleteArtworkCommentInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
): Promise<{ artworkId: string; body: string; createdAt: Date; id: string; updatedAt: Date }> => {
	const actor = requireActor(context);
	const { now: getNow, repository } = getDependencies(dependencies);
	await getArtworkOrThrow(input.artworkId, repository);
	const comment = await repository.findCommentById(input.commentId);

	if (!comment || comment.artworkId !== input.artworkId) {
		throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
	}

	assertAuthor(comment.authorId, actor.user.id);
	const deleted = await repository.deleteComment(input.commentId, getNow());

	if (!deleted) {
		throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
	}

	publishArtworkChange(deleted.artworkId, { change: 'comments' });
	return {
		artworkId: deleted.artworkId,
		body: deleted.body,
		createdAt: deleted.createdAt,
		id: deleted.id,
		updatedAt: deleted.updatedAt
	};
};

export const submitContentReport = async (
	input: SubmitContentReportInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
) => {
	const actor = requireActor(context);
	const { generateId: nextId, now: getNow, repository } = getDependencies(dependencies);
	const now = getNow();
	const { artworkId, commentId } = assertExactlyOneReportTarget(input.artworkId, input.commentId);

	if (artworkId) {
		await getArtworkOrThrow(artworkId, repository);
	}

	let reportedCommentArtworkId: string | null = null;
	if (commentId) {
		const comment = await repository.findCommentById(commentId);
		if (!comment) {
			throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
		}
		if (comment.isHidden) {
			throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
		}
		reportedCommentArtworkId = comment.artworkId;
	}

	const report = await repository
		.createContentReport({
			artworkId,
			commentId,
			createdAt: now,
			details: normalizeReportDetails(input.details),
			id: nextId(),
			reason: normalizeReportReason(input.reason),
			reporterId: actor.user.id,
			reviewedAt: null,
			reviewedBy: null,
			status: 'pending',
			updatedAt: now
		})
		.catch((error: unknown) => {
			if (isPendingReportUniqueViolation(error)) {
				throw new ArtworkFlowError(
					409,
					'An active report already exists for this target',
					'DUPLICATE_REPORT'
				);
			}

			throw error;
		});

	// Enough reports hide a comment inside the database, so whoever is watching
	// the artwork rechecks its comments after every comment report.
	if (reportedCommentArtworkId) {
		publishArtworkChange(reportedCommentArtworkId, { change: 'comments' });
	}

	return report;
};

export const moderateArtwork = async (
	input: ModerateArtworkInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
) => {
	const actor = assertModerator(context);
	const { now: getNow, repository, storage } = getDependencies(dependencies);
	const now = getNow();
	const artwork = await getArtworkOrThrow(input.artworkId, repository);
	const resolution = {
		resolvedAt: now,
		resolvedBy: actor.user.id,
		status: getResolutionStatus(input.action),
		targetId: artwork.id
	} as const;

	if (input.action === 'delete') {
		await storage.delete(artwork.storageKey);
		await repository.resolveArtworkReports(resolution);
		const deleted = await repository.deleteArtwork(artwork.id);
		if (!deleted) {
			throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
		}

		return deleted;
	}

	if (input.action === 'dismiss') {
		await repository.resolveArtworkReports(resolution);
		return artwork;
	}

	if (input.action === 'mark_nsfw') {
		const updated = await repository.updateArtworkModeration(artwork.id, {
			hiddenAt: now,
			isHidden: true,
			isNsfw: true,
			nsfwLabeledAt: now,
			nsfwSource: 'moderator',
			updatedAt: now
		});
		await repository.resolveArtworkReports(resolution);

		if (!updated) {
			throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
		}

		return updated;
	}

	if (input.action === 'clear_nsfw') {
		const updated = await repository.updateArtworkModeration(artwork.id, {
			isNsfw: false,
			nsfwLabeledAt: null,
			nsfwSource: null,
			updatedAt: now
		});
		await repository.resolveArtworkReports(resolution);

		if (!updated) {
			throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
		}

		return updated;
	}

	const updated = await repository.setArtworkHiddenState(artwork.id, {
		hiddenAt: input.action === 'hide' ? now : null,
		isHidden: input.action === 'hide',
		updatedAt: now
	});
	await repository.resolveArtworkReports(resolution);

	if (!updated) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

	return updated;
};

export const moderateComment = async (
	input: ModerateCommentInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
) => {
	const actor = assertModerator(context);
	const { now: getNow, repository } = getDependencies(dependencies);
	const now = getNow();
	await getArtworkOrThrow(input.artworkId, repository);
	const comment = await repository.findCommentById(input.commentId);
	const resolution = {
		resolvedAt: now,
		resolvedBy: actor.user.id,
		status: getResolutionStatus(input.action),
		targetId: input.commentId
	} as const;

	if (!comment || comment.artworkId !== input.artworkId) {
		throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
	}

	if (input.action === 'delete') {
		await repository.resolveCommentReports(resolution);
		const deleted = await repository.deleteComment(comment.id, now);
		if (!deleted) {
			throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
		}

		publishArtworkChange(input.artworkId, { change: 'comments' });
		return deleted;
	}

	if (input.action === 'dismiss') {
		await repository.resolveCommentReports(resolution);
		return comment;
	}

	const updated = await repository.setCommentHiddenState(comment.id, {
		hiddenAt: input.action === 'hide' ? now : null,
		isHidden: input.action === 'hide',
		updatedAt: now
	});
	await repository.resolveCommentReports(resolution);

	if (!updated) {
		throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
	}

	publishArtworkChange(input.artworkId, { change: 'comments' });
	return updated;
};
