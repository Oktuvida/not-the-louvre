import { generateId } from 'better-auth';
import { ARTWORK_PUBLISH_RATE_LIMIT } from './config';
import { ArtworkFlowError } from './errors';
import { artworkRepository } from './repository';
import { supabaseArtworkStorage } from './storage';
import type { ArtworkActorContext, ArtworkRepository, ArtworkStorage } from './types';
import { normalizePublishTitle, normalizeUpdatedTitle, validateArtworkMedia } from './validation';

type PublishArtworkInput = {
	media: File;
	title?: string | null;
};

type UpdateArtworkTitleInput = {
	artworkId: string;
	title: string;
};

type DeleteArtworkInput = {
	artworkId: string;
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
	const media = await validateArtworkMedia(input.media);
	const artworkId = nextId();
	const storageKey = `artworks/${actor.user.id}/${artworkId}.avif`;

	await storage.upload(storageKey, input.media);

	try {
		const artwork = await repository.createArtwork({
			authorId: actor.user.id,
			createdAt: now,
			id: artworkId,
			mediaContentType: media.contentType,
			mediaSizeBytes: media.sizeBytes,
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
