import { AVATAR_STORAGE_KEY_PREFIX } from './config';
import { contentHash } from '#lib/server/media/content-hash.js';
import { prepareDrawingDocumentForStorage } from '#lib/server/drawing-document/storage.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import {
	assertActiveUser,
	assertAuthenticatedUser,
	assertNotBanned
} from '#lib/server/auth/guards.js';
import {
	DRAWING_DOCUMENT_CHUNK_CHARS,
	writeDrawingDocumentInChunks,
	type DrawingDocumentChunkStore
} from '#lib/server/drawing-document/chunked-write.js';
import { createAvatarDrawingDocumentMedia } from '#lib/server/drawing-document/media.js';
import type { ArtworkStorage } from '#lib/server/artwork/types.js';
import type { CanonicalUser } from '#lib/server/auth/types.js';
import { userRepository } from './repository';
import { avatarStorage } from './storage';
import type { UserAvatarDocumentRef, UserRecord, UserRepository } from './types';

// Named after the image itself, so a new avatar gets a new address and every
// cache may keep the old one without ever showing it again (see avatar-url.ts).
const getAvatarStorageKey = async (userId: string, image: File) => {
	const hash = await contentHash(await image.arrayBuffer());
	return `${AVATAR_STORAGE_KEY_PREFIX}/${userId}/${hash.slice(0, 16)}.webp`;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type AvatarServiceDependencies = {
	drawingDocumentChunkChars?: number;
	repository: UserRepository;
	sleep?: (ms: number) => Promise<void>;
	storage: ArtworkStorage;
};

// Binds the shared chunked-write ladder to app.users, so avatars and artworks
// go through one retry implementation instead of two that can drift.
const createAvatarDocumentStore = (
	repository: UserRepository
): DrawingDocumentChunkStore<UserAvatarDocumentRef> => ({
	appendChunk: (id, chunk, expectedLength, updatedAt) =>
		repository.appendUserAvatarDocumentChunk(id, chunk, expectedLength, updatedAt),
	finalize: (id, version, expectedTotalLength, updatedAt) =>
		repository.finalizeUserAvatarDocument(id, version, expectedTotalLength, updatedAt),
	findDocumentLength: (id) => repository.findUserAvatarDocumentLength(id),
	findFinalized: async (id, version) => {
		const committed = await repository.findUserAvatarDocumentRef(id);
		return committed?.avatarDocumentVersion === version ? committed : null;
	}
});

export const createAvatarService = (deps: AvatarServiceDependencies) => {
	const { repository, storage } = deps;
	const chunkChars = deps.drawingDocumentChunkChars ?? DRAWING_DOCUMENT_CHUNK_CHARS;
	const sleep = deps.sleep ?? defaultSleep;

	return {
		async uploadAvatar(user: CanonicalUser | null, drawingDocument: string): Promise<UserRecord> {
			const activeUser = assertActiveUser(user);

			const preparedDocument = await prepareDrawingDocumentForStorage(drawingDocument);
			if (preparedDocument.document.kind !== 'avatar') {
				throw new ArtworkFlowError(
					400,
					'Avatar save requires an avatar drawing document',
					'INVALID_MEDIA_FORMAT'
				);
			}

			const sanitizedMedia = await createAvatarDrawingDocumentMedia(preparedDocument.document);
			const encodedDocument = preparedDocument.compressedDocumentBase64;

			const storageKey = await getAvatarStorageKey(activeUser.id, sanitizedMedia.file);
			await storage.upload(storageKey, sanitizedMedia.file);
			const completedAt = new Date();

			// The row is updated without the drawing document so the UPDATE's Bind
			// stays small — Supavisor drops sessions that receive the whole
			// document in one message, which is what used to kill a detailed
			// avatar save outright. Both document columns are reset here so a
			// previous avatar's leftovers cannot survive a partial rewrite; the
			// document follows in chunked appends below.
			const updatedUser = repository.updateUserAvatar
				? await repository.updateUserAvatar(activeUser.id, {
						avatarDocument: null,
						avatarDocumentVersion: null,
						avatarOnboardingCompletedAt: completedAt,
						avatarUrl: storageKey,
						updatedAt: completedAt
					})
				: await repository.updateUserAvatarUrl(activeUser.id, storageKey, completedAt, completedAt);
			if (!updatedUser) {
				await storage.delete(storageKey).catch(() => {});
				throw new ArtworkFlowError(500, 'Avatar upload failed', 'PUBLISH_FAILED');
			}

			// Nothing points at the previous image once the row is committed. A
			// failed delete only leaves an orphan behind.
			const previousStorageKey = activeUser.avatarUrl;
			if (previousStorageKey && previousStorageKey !== storageKey) {
				await storage.delete(previousStorageKey).catch(() => {});
			}

			// The avatar row is committed past this point: a failed document write
			// must not fail the save during onboarding. It degrades to an avatar
			// image the user cannot reopen in the editor, and avatar_document_version
			// stays null so readers treat the partial document as absent.
			let avatarDocumentVersion: number | null = null;
			try {
				const finalized = await writeDrawingDocumentInChunks({
					category: 'avatar',
					chunkChars,
					documentBase64: encodedDocument,
					logFields: { userId: activeUser.id },
					now: completedAt,
					sleep,
					store: createAvatarDocumentStore(repository),
					targetId: activeUser.id,
					version: preparedDocument.version
				});

				if (finalized) {
					avatarDocumentVersion = finalized.avatarDocumentVersion;
				} else {
					console.error(
						JSON.stringify({
							category: 'avatar',
							drawingDocumentChars: encodedDocument.length,
							event: 'drawing_document_write_failed',
							userId: activeUser.id
						})
					);
				}
			} catch (error) {
				console.error(
					JSON.stringify({
						category: 'avatar',
						code: error instanceof Error ? error.name : 'UNKNOWN',
						drawingDocumentChars: encodedDocument.length,
						event: 'drawing_document_write_failed',
						userId: activeUser.id
					})
				);
			}

			return { ...updatedUser, avatarDocumentVersion };
		},

		async deleteAvatar(user: CanonicalUser | null): Promise<UserRecord> {
			const activeUser = assertActiveUser(user);

			const record = await repository.findUserById(activeUser.id);
			if (!record) {
				throw new ArtworkFlowError(404, 'User not found', 'NOT_FOUND');
			}

			if (!record.avatarUrl) {
				return record;
			}

			const storageKey = record.avatarUrl;
			// Clears both columns so a versionless leftover cannot be revived by a
			// later append that happens to match its length.
			const updatedUser = repository.updateUserAvatar
				? await repository.updateUserAvatar(activeUser.id, {
						avatarDocument: null,
						avatarDocumentVersion: null,
						avatarOnboardingCompletedAt: record.avatarOnboardingCompletedAt ?? null,
						avatarUrl: null,
						updatedAt: new Date()
					})
				: await repository.updateUserAvatarUrl(
						activeUser.id,
						null,
						record.avatarOnboardingCompletedAt ?? null,
						new Date()
					);
			if (!updatedUser) {
				throw new ArtworkFlowError(500, 'Avatar deletion failed', 'PUBLISH_FAILED');
			}

			await storage.delete(storageKey).catch(() => {});

			return updatedUser;
		},

		async moderateAvatar(
			user: CanonicalUser | null,
			targetUserId: string,
			action: 'hide' | 'unhide' | 'mark_nsfw' | 'clear_nsfw'
		): Promise<UserRecord> {
			const actor = assertNotBanned(assertAuthenticatedUser(user));

			if (actor.role !== 'moderator' && actor.role !== 'admin') {
				throw new ArtworkFlowError(403, 'Moderator access required', 'FORBIDDEN');
			}

			// Existence check only, so it must not drag the target's avatar document
			// across the pooler — the update below returns the fields the response
			// needs.
			const existing = await repository.findUserAvatarRefById(targetUserId);
			if (!existing) {
				throw new ArtworkFlowError(404, 'User not found', 'NOT_FOUND');
			}

			const updatedAt = new Date();
			const nextState =
				action === 'hide'
					? { avatarIsHidden: true }
					: action === 'unhide'
						? { avatarIsHidden: false }
						: action === 'mark_nsfw'
							? { avatarIsHidden: true, avatarIsNsfw: true }
							: { avatarIsNsfw: false };

			const updated = await repository.updateAvatarModeration(targetUserId, {
				...nextState,
				updatedAt
			});

			if (!updated) {
				throw new ArtworkFlowError(500, 'Avatar moderation failed', 'PUBLISH_FAILED');
			}

			return updated;
		}
	};
};

export const avatarService = createAvatarService({
	repository: userRepository,
	storage: avatarStorage
});
