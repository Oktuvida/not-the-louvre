import { generateId } from 'better-auth';
import {
	ARTWORK_COMMENT_MAX_LENGTH,
	ARTWORK_COMMENT_RATE_LIMIT,
	ARTWORK_PUBLISH_RATE_LIMIT,
	ARTWORK_VOTE_RATE_LIMIT,
	CONTENT_REPORT_AUTO_HIDE_THRESHOLD,
	CONTENT_REPORT_DETAILS_MAX_LENGTH
} from './config';
import { ArtworkFlowError } from './errors';
import { artworkRepository } from './repository';
import { supabaseArtworkStorage } from './storage';
import type {
	ArtworkActorContext,
	ArtworkCommentView,
	ArtworkEngagementRateLimitKind,
	ArtworkReportReason,
	ArtworkRepository,
	ArtworkStorage,
	ArtworkVoteMutationResult,
	ArtworkVoteRemovalResult,
	ArtworkVisibilityActor,
	ArtworkVoteValue
} from './types';
import { normalizePublishTitle, normalizeUpdatedTitle, validateArtworkMedia } from './validation';

type PublishArtworkInput = {
	media: File;
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
	action: 'delete' | 'hide' | 'unhide';
	artworkId: string;
};

type ModerateCommentInput = {
	action: 'delete' | 'hide' | 'unhide';
	artworkId: string;
	commentId: string;
};

type ServiceDependencies = {
	generateId?: () => string;
	now?: () => Date;
	randomSuffix?: () => number;
	repository?: ArtworkRepository;
	storage?: ArtworkStorage;
};

const getDependencies = (dependencies: ServiceDependencies = {}) => ({
	generateId: dependencies.generateId ?? generateId,
	now: dependencies.now ?? (() => new Date()),
	randomSuffix: dependencies.randomSuffix ?? (() => Math.floor(Math.random() * 10000)),
	repository: dependencies.repository ?? artworkRepository,
	storage: dependencies.storage ?? supabaseArtworkStorage
});

const requireActor = (context: Partial<ArtworkActorContext>): ArtworkActorContext => {
	if (!context.user) {
		throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
	}

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
	if (value === 'up' || value === 'down') {
		return value;
	}

	throw new ArtworkFlowError(400, 'Vote must be either up or down', 'INVALID_VOTE');
};

const assertEngagementRateLimit = async (
	kind: ArtworkEngagementRateLimitKind,
	context: ArtworkActorContext,
	repository: ArtworkRepository,
	now: Date,
	message: string
) => {
	const actorKey = getActorKey(context);
	const record = await repository.findEngagementRateLimit(kind, actorKey);

	if (record?.blockedUntil && record.blockedUntil > now) {
		throw new ArtworkFlowError(429, message, 'RATE_LIMITED');
	}

	return { actorKey, record };
};

const recordEngagementAttempt = async (
	kind: ArtworkEngagementRateLimitKind,
	context: ArtworkActorContext,
	repository: ArtworkRepository,
	now: Date,
	nextId: () => string,
	config: { maxAttempts: number; windowMs: number },
	message: string
) => {
	const { actorKey, record } = await assertEngagementRateLimit(
		kind,
		context,
		repository,
		now,
		message
	);
	const withinWindow =
		record && now.getTime() - record.windowStartedAt.getTime() <= config.windowMs;
	const attemptCount = withinWindow ? record.attemptCount + 1 : 1;
	const windowStartedAt = withinWindow && record ? record.windowStartedAt : now;
	const blockedUntil =
		attemptCount >= config.maxAttempts
			? new Date(windowStartedAt.getTime() + config.windowMs)
			: null;

	if (!record) {
		await repository.createEngagementRateLimit({
			actorKey,
			attemptCount,
			blockedUntil,
			createdAt: now,
			id: nextId(),
			kind,
			lastAttemptAt: now,
			updatedAt: now,
			windowStartedAt
		});
	} else {
		await repository.updateEngagementRateLimit(record.id, {
			attemptCount,
			blockedUntil,
			lastAttemptAt: now,
			updatedAt: now,
			windowStartedAt
		});
	}

	if (blockedUntil) {
		throw new ArtworkFlowError(429, message, 'RATE_LIMITED');
	}
};

const assertPublishRateLimit = async (
	context: ArtworkActorContext,
	repository: ArtworkRepository,
	now: Date
) => {
	const actorKey = getActorKey(context);
	const record = await repository.findPublishRateLimit(actorKey);

	if (record?.blockedUntil && record.blockedUntil > now) {
		throw new ArtworkFlowError(
			429,
			'Too many publish attempts. Please wait before trying again.',
			'RATE_LIMITED'
		);
	}

	return { actorKey, record };
};

const recordPublishAttempt = async (
	context: ArtworkActorContext,
	repository: ArtworkRepository,
	now: Date,
	generateIdValue: () => string
) => {
	const { actorKey, record } = await assertPublishRateLimit(context, repository, now);
	const withinWindow =
		record &&
		now.getTime() - record.windowStartedAt.getTime() <= ARTWORK_PUBLISH_RATE_LIMIT.windowMs;
	const attemptCount = withinWindow ? (record?.attemptCount ?? 0) + 1 : 1;
	const windowStartedAt = withinWindow && record ? record.windowStartedAt : now;
	const blockedUntil =
		attemptCount >= ARTWORK_PUBLISH_RATE_LIMIT.maxAttempts
			? new Date(windowStartedAt.getTime() + ARTWORK_PUBLISH_RATE_LIMIT.windowMs)
			: null;

	if (!record) {
		await repository.createPublishRateLimit({
			actorKey,
			attemptCount,
			blockedUntil,
			createdAt: now,
			id: generateIdValue(),
			lastAttemptAt: now,
			updatedAt: now,
			windowStartedAt
		});
		return;
	}

	await repository.updatePublishRateLimit(record.id, {
		attemptCount,
		blockedUntil,
		lastAttemptAt: now,
		updatedAt: now,
		windowStartedAt
	});
	if (blockedUntil && blockedUntil.getTime() === now.getTime()) {
		throw new ArtworkFlowError(
			429,
			'Too many publish attempts. Please wait before trying again.',
			'RATE_LIMITED'
		);
	}
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
	const reasons: ArtworkReportReason[] = [
		'spam',
		'harassment',
		'hate',
		'sexual_content',
		'violence',
		'misinformation',
		'copyright',
		'other'
	];

	if (reasons.includes(normalized as ArtworkReportReason)) {
		return normalized as ArtworkReportReason;
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

const maybeAutoHideArtwork = async (
	artworkId: string,
	repository: ArtworkRepository,
	now: Date
) => {
	const artwork = await repository.findArtworkById(artworkId);
	if (!artwork || artwork.isHidden) return artwork;

	const reportCount = await repository.findArtworkReportCount(artworkId);
	if (reportCount < CONTENT_REPORT_AUTO_HIDE_THRESHOLD) {
		return artwork;
	}

	return repository.setArtworkHiddenState(artworkId, {
		hiddenAt: now,
		isHidden: true,
		updatedAt: now
	});
};

const maybeAutoHideComment = async (
	commentId: string,
	repository: ArtworkRepository,
	now: Date
) => {
	const comment = await repository.findCommentById(commentId);
	if (!comment || comment.isHidden) return comment;

	const reportCount = await repository.findCommentReportCount(commentId);
	if (reportCount < CONTENT_REPORT_AUTO_HIDE_THRESHOLD) {
		return comment;
	}

	return repository.setCommentHiddenState(commentId, {
		hiddenAt: now,
		isHidden: true,
		updatedAt: now
	});
};

export const publishArtwork = async (
	input: PublishArtworkInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
) => {
	const actor = requireActor(context);
	const {
		generateId: nextId,
		now: getNow,
		randomSuffix,
		repository,
		storage
	} = getDependencies(dependencies);
	const now = getNow();

	await assertPublishRateLimit(actor, repository, now);

	const title = normalizePublishTitle(input.title, randomSuffix());
	const parentArtworkId = input.parentArtworkId?.trim() ? input.parentArtworkId.trim() : null;

	if (parentArtworkId) {
		const parentArtwork = await repository.findArtworkById(parentArtworkId);
		if (!parentArtwork) {
			throw new ArtworkFlowError(400, 'Fork parent artwork not found', 'INVALID_FORK_PARENT');
		}
	}

	const media = await validateArtworkMedia(input.media);
	const artworkId = nextId();
	const storageKey = `artworks/${actor.user.id}/${artworkId}.avif`;

	await storage.upload(storageKey, input.media);

	try {
		const artwork = await repository.createArtwork({
			authorId: actor.user.id,
			commentCount: 0,
			createdAt: now,
			forkCount: 0,
			id: artworkId,
			mediaContentType: media.contentType,
			mediaSizeBytes: media.sizeBytes,
			parentId: parentArtworkId,
			score: 0,
			storageKey,
			title,
			updatedAt: now
		});

		await recordPublishAttempt(actor, repository, now, nextId);
		return artwork;
	} catch (error) {
		try {
			await storage.delete(storageKey);
		} catch {
			// best effort cleanup after a partial publish failure
		}

		if (error instanceof ArtworkFlowError) {
			throw error;
		}

		throw new ArtworkFlowError(500, 'Artwork publish failed', 'PUBLISH_FAILED');
	}
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

	const updated = await repository.updateArtworkTitle(
		artwork.id,
		normalizeUpdatedTitle(input.title),
		getNow()
	);

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
	const artwork = await getArtworkOrThrow(input.artworkId, repository);

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
		artworkId: artwork.id,
		createdAt: now,
		id: nextId(),
		updatedAt: now,
		userId: actor.user.id,
		value: normalizeVoteValue(input.value)
	});

	if (!result) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

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

	const comment = await repository.createComment({
		authorId: actor.user.id,
		artworkId: artwork.id,
		body: normalizeCommentBody(input.body),
		createdAt: now,
		id: nextId(),
		updatedAt: now
	});

	if (!comment) {
		throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
	}

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

	if (commentId) {
		const comment = await repository.findCommentById(commentId);
		if (!comment) {
			throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
		}
		if (comment.isHidden) {
			throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
		}
	}

	const report = await repository.createContentReport({
		artworkId,
		commentId,
		createdAt: now,
		details: normalizeReportDetails(input.details),
		id: nextId(),
		reason: normalizeReportReason(input.reason),
		reporterId: actor.user.id,
		updatedAt: now
	});

	if (artworkId) {
		await maybeAutoHideArtwork(artworkId, repository, now);
	}

	if (commentId) {
		await maybeAutoHideComment(commentId, repository, now);
	}

	return report;
};

export const moderateArtwork = async (
	input: ModerateArtworkInput,
	context: Partial<ArtworkActorContext>,
	dependencies: ServiceDependencies = {}
) => {
	assertModerator(context);
	const { now: getNow, repository, storage } = getDependencies(dependencies);
	const now = getNow();
	const artwork = await getArtworkOrThrow(input.artworkId, repository);

	if (input.action === 'delete') {
		await storage.delete(artwork.storageKey);
		const deleted = await repository.deleteArtwork(artwork.id);
		if (!deleted) {
			throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
		}

		return deleted;
	}

	const updated = await repository.setArtworkHiddenState(artwork.id, {
		hiddenAt: input.action === 'hide' ? now : null,
		isHidden: input.action === 'hide',
		updatedAt: now
	});

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
	assertModerator(context);
	const { now: getNow, repository } = getDependencies(dependencies);
	await getArtworkOrThrow(input.artworkId, repository);
	const comment = await repository.findCommentById(input.commentId);

	if (!comment || comment.artworkId !== input.artworkId) {
		throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
	}

	if (input.action === 'delete') {
		const deleted = await repository.deleteComment(comment.id, getNow());
		if (!deleted) {
			throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
		}

		return deleted;
	}

	const now = getNow();
	const updated = await repository.setCommentHiddenState(comment.id, {
		hiddenAt: input.action === 'hide' ? now : null,
		isHidden: input.action === 'hide',
		updatedAt: now
	});

	if (!updated) {
		throw new ArtworkFlowError(404, 'Comment not found', 'NOT_FOUND');
	}

	return updated;
};
