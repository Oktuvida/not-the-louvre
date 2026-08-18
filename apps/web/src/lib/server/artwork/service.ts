import { generateId } from 'better-auth';
import { assertNotBanned } from '$lib/server/auth/guards';
import {
	ARTWORK_COMMENT_MAX_LENGTH,
	ARTWORK_COMMENT_RATE_LIMIT,
	ARTWORK_PUBLISH_RATE_LIMIT,
	ARTWORK_VOTE_RATE_LIMIT,
	CONTENT_REPORT_DETAILS_MAX_LENGTH
} from './config';
import { ArtworkFlowError, logArtworkFlowFailure } from './errors';
import { artworkRepository } from './repository';
import { supabaseArtworkStorage } from './storage';
import { checkTextModeration } from '$lib/server/moderation/service';
import { prepareDrawingDocumentForStorage } from '$lib/features/stroke-json/runtime.server';
import type {
	ArtworkActorContext,
	ArtworkCommentView,
	ArtworkEngagementRateLimitKind,
	ArtworkReportReason,
	ArtworkRepository,
	ArtworkStorage,
	ArtworkVoteMutationResult,
	ArtworkVoteRemovalResult,
	ContentReportStatus,
	SanitizedMedia,
	ArtworkVisibilityActor,
	ArtworkVoteValue
} from './types';
import { sanitizeArtworkMedia } from '../media/sanitization';
import { createArtworkDrawingDocumentMedia } from '$lib/server/drawing-document/media';
import { normalizePublishTitle, normalizeUpdatedTitle } from './validation';

type PublishArtworkInput = {
	drawingDocument?: string | null;
	isNsfw?: boolean;
	media?: File | null;
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
	generateId?: () => string;
	now?: () => Date;
	randomSuffix?: () => number;
	repository?: ArtworkRepository;
	renderDrawingDocumentMedia?: typeof createArtworkDrawingDocumentMedia;
	sanitizeMedia?: (file: File) => Promise<SanitizedMedia>;
	sleep?: (ms: number) => Promise<void>;
	storage?: ArtworkStorage;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const getDependencies = (dependencies: ServiceDependencies = {}) => ({
	generateId: dependencies.generateId ?? generateId,
	now: dependencies.now ?? (() => new Date()),
	randomSuffix: dependencies.randomSuffix ?? (() => Math.floor(Math.random() * 10000)),
	repository: dependencies.repository ?? artworkRepository,
	renderDrawingDocumentMedia:
		dependencies.renderDrawingDocumentMedia ?? createArtworkDrawingDocumentMedia,
	sanitizeMedia: dependencies.sanitizeMedia ?? sanitizeArtworkMedia,
	sleep: dependencies.sleep ?? defaultSleep,
	storage: dependencies.storage ?? supabaseArtworkStorage
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

const hasErrorCode = (error: unknown, code: string): boolean => {
	let current: unknown = error;
	while (current instanceof Error) {
		if ((current as { code?: unknown }).code === code) {
			return true;
		}
		current = current.cause;
	}

	return false;
};

const isConnectionClosedError = (error: unknown) => hasErrorCode(error, 'CONNECTION_CLOSED');

// A redial that cannot complete (pooler restarting) surfaces CONNECT_TIMEOUT
// now that connect_timeout is set on the client; the next delayed attempt
// should still run. Unlike CONNECTION_CLOSED it is unambiguous: the query
// never reached Postgres.
const isRetryableConnectionError = (error: unknown) =>
	isConnectionClosedError(error) || hasErrorCode(error, 'CONNECT_TIMEOUT');

// Postgres unique_violation. After a closed-mid-query attempt it means that
// attempt actually committed before the socket died and only the ack was lost.
const isUniqueViolation = (error: unknown) => hasErrorCode(error, '23505');

// CONNECTION_CLOSED means the pooler dropped the session while the insert was
// in flight, which an immediate reissue cannot outrun (prod evidence: the
// zero-delay retry failed identically), so retries back off. A closed-mid-query
// insert is ambiguous — it may have committed with only the ack lost — so every
// ambiguous exit re-reads the row (the id is generated per request, so a found
// row or a unique violation can only be this request's own insert) and the
// result reports whether the uploaded media may belong to a committed row.
const INSERT_RETRY_DELAYS_MS = [500, 2000];

const insertWithConnectionRetries = async <T>(
	run: () => Promise<T>,
	options: {
		readBackCommittedRow: () => Promise<T | null>;
		sleep: (ms: number) => Promise<void>;
	}
): Promise<{ artwork: T } | { error: unknown; mayHaveCommitted: boolean }> => {
	const readBack = async () => {
		try {
			return await options.readBackCommittedRow();
		} catch {
			await options.sleep(1000);
			return options.readBackCommittedRow();
		}
	};

	const recovered = (artwork: T) => {
		console.warn(JSON.stringify({ category: 'artwork', event: 'insert_recovered_from_lost_ack' }));
		return { artwork };
	};

	let lastError: unknown;
	let sawAmbiguousClose = false;

	for (let attempt = 0; attempt <= INSERT_RETRY_DELAYS_MS.length; attempt += 1) {
		if (attempt > 0) {
			const delayMs = INSERT_RETRY_DELAYS_MS[attempt - 1]!;
			console.warn(
				JSON.stringify({
					attempt,
					category: 'artwork',
					delayMs,
					event: 'insert_retry_connection_closed'
				})
			);
			await options.sleep(delayMs);
		}

		try {
			return { artwork: await run() };
		} catch (error) {
			if (sawAmbiguousClose && isUniqueViolation(error)) {
				// An earlier ambiguous attempt actually committed.
				try {
					const committed = await readBack();
					if (committed) {
						return recovered(committed);
					}
				} catch {
					// proven committed but unreadable; fall through
				}
				return { error, mayHaveCommitted: true };
			}

			if (!isRetryableConnectionError(error)) {
				return { error, mayHaveCommitted: false };
			}
			sawAmbiguousClose ||= isConnectionClosedError(error);
			lastError = error;
		}
	}

	if (!sawAmbiguousClose) {
		return { error: lastError, mayHaveCommitted: false };
	}

	// Retries exhausted after at least one closed-mid-query attempt; the last
	// such attempt may have committed, so resolve the ambiguity before the
	// caller decides whether the uploaded media can be cleaned up.
	try {
		const committed = await readBack();
		if (committed) {
			return recovered(committed);
		}
		return { error: lastError, mayHaveCommitted: false };
	} catch {
		return { error: lastError, mayHaveCommitted: true };
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

const isPendingReportUniqueViolation = (error: unknown) => {
	if (!error || typeof error !== 'object') return false;

	const candidate = error as {
		code?: string;
		constraint?: string;
		constraint_name?: string;
		message?: string;
	};
	const constraint = candidate.constraint_name ?? candidate.constraint ?? candidate.message ?? '';

	return (
		candidate.code === '23505' &&
		(typeof constraint !== 'string'
			? false
			: constraint.includes('content_reports_pending_artwork_reporter_unique') ||
				constraint.includes('content_reports_pending_comment_reporter_unique'))
	);
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
		generateId: nextId,
		now: getNow,
		randomSuffix,
		repository,
		renderDrawingDocumentMedia,
		sanitizeMedia,
		sleep,
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

	let media: SanitizedMedia;
	let drawingDocument: string | null = null;
	let drawingVersion: number | null = null;

	const providedDrawingDocument = input.drawingDocument?.trim() ?? '';
	if (providedDrawingDocument) {
		const preparedDocument = await prepareDrawingDocumentForStorage(providedDrawingDocument);
		if (preparedDocument.document.kind !== 'artwork') {
			throw new ArtworkFlowError(
				400,
				'Artwork publish requires an artwork drawing document',
				'INVALID_MEDIA_FORMAT'
			);
		}

		media = await renderDrawingDocumentMedia(preparedDocument.document);
		drawingDocument = preparedDocument.compressedDocumentBase64;
		drawingVersion = preparedDocument.version;
	} else if (input.media instanceof File) {
		media = await sanitizeMedia(input.media);
	} else {
		throw new ArtworkFlowError(400, 'Artwork media is required', 'INVALID_MEDIA_FORMAT');
	}

	const artworkId = nextId();
	const storageKey = `artworks/${actor.user.id}/${artworkId}.avif`;

	await storage.upload(storageKey, media.file);

	const outcome = await insertWithConnectionRetries(
		() =>
			repository.createArtwork({
				authorId: actor.user.id,
				commentCount: 0,
				createdAt: now,
				drawingDocument,
				drawingVersion,
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
			}),
		{
			readBackCommittedRow: () => repository.findArtworkById(artworkId),
			sleep
		}
	);

	if ('error' in outcome) {
		// Payload sizes discriminate a size-triggered pooler abort from pooler
		// health issues; the content itself stays out of the logs.
		console.error(
			JSON.stringify({
				artworkId,
				category: 'artwork',
				drawingDocumentChars: drawingDocument?.length ?? 0,
				event: 'publish_persist_failed',
				hasParent: Boolean(parentArtworkId),
				mayHaveCommitted: outcome.mayHaveCommitted,
				mediaContentType: media.contentType,
				mediaSizeBytes: media.sizeBytes
			})
		);

		// An orphaned storage object is recoverable; a committed artwork row
		// pointing at deleted media is not.
		if (!outcome.mayHaveCommitted) {
			try {
				await storage.delete(storageKey);
			} catch {
				// best effort cleanup after a partial publish failure
			}
		}

		if (outcome.error instanceof ArtworkFlowError) {
			throw outcome.error;
		}

		throw new ArtworkFlowError(500, 'Artwork publish failed', 'PUBLISH_FAILED', {
			cause: outcome.error
		});
	}

	const artwork = outcome.artwork;

	// The artwork row is committed past this point: rate-limit bookkeeping must
	// not fail the publish, and above all must not delete the committed
	// artwork's media from storage.
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

	return updated;
};
