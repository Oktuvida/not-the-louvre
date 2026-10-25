import { avatarStorageKey } from './avatar-key';
import { prepareDrawingDocumentForStorage } from '#lib/server/drawing-document/storage.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import {
	assertActiveUser,
	assertAuthenticatedUser,
	assertNotBanned
} from '#lib/server/auth/guards.js';
import {
	drawingDocumentStore,
	type DrawingDocumentStore
} from '#lib/server/drawing-document/document-store.js';
import { renderAvatarMedia } from '#lib/server/render/client.js';
import type { ArtworkStorage } from '#lib/server/artwork/types.js';
import type { CanonicalUser } from '#lib/server/auth/types.js';
import { userRepository } from './repository';
import { avatarStorage } from './storage';
import type { UserRecord, UserRepository } from './types';

type AvatarServiceDependencies = {
	documents?: DrawingDocumentStore;
	repository: UserRepository;
	storage: ArtworkStorage;
};

export const createAvatarService = (deps: AvatarServiceDependencies) => {
	const { repository, storage } = deps;
	const documents = deps.documents ?? drawingDocumentStore;

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

			const sanitizedMedia = await renderAvatarMedia(preparedDocument.document);

			// The drawing and its image go to object storage first; the row update
			// comes last and names both, so the editor never reopens a half-saved
			// avatar.
			const avatarDocumentKey = await documents.put(preparedDocument.compressed);
			const storageKey = await avatarStorageKey(
				activeUser.id,
				new Uint8Array(await sanitizedMedia.file.arrayBuffer())
			);
			await storage.upload(storageKey, sanitizedMedia.file);
			const completedAt = new Date();

			const updatedUser = await repository.updateUserAvatar(activeUser.id, {
				avatarDocument: null,
				avatarDocumentKey,
				avatarDocumentVersion: preparedDocument.version,
				avatarOnboardingCompletedAt: completedAt,
				avatarUrl: storageKey,
				updatedAt: completedAt
			});
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

			return updatedUser;
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
			const updatedUser = await repository.updateUserAvatar(activeUser.id, {
				avatarDocument: null,
				avatarDocumentKey: null,
				avatarDocumentVersion: null,
				avatarOnboardingCompletedAt: record.avatarOnboardingCompletedAt ?? null,
				avatarUrl: null,
				updatedAt: new Date()
			});
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
