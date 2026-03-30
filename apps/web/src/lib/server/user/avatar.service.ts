import { AVATAR_STORAGE_KEY_PREFIX } from './config';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	assertActiveUser,
	assertAuthenticatedUser,
	assertNotBanned
} from '$lib/server/auth/guards';
import { sanitizeAvatarMedia } from '$lib/server/media/sanitization';
import type { ArtworkStorage } from '$lib/server/artwork/types';
import type { CanonicalUser } from '$lib/server/auth/types';
import { userRepository } from './repository';
import { supabaseAvatarStorage } from './storage';
import type { UserRecord, UserRepository } from './types';

const getAvatarStorageKey = (userId: string) => `${AVATAR_STORAGE_KEY_PREFIX}/${userId}.avif`;

type AvatarServiceDependencies = {
	repository: UserRepository;
	storage: ArtworkStorage;
};

export const createAvatarService = (deps: AvatarServiceDependencies) => {
	const { repository, storage } = deps;

	return {
		async uploadAvatar(user: CanonicalUser | null, media: File): Promise<UserRecord> {
			const activeUser = assertActiveUser(user);

			const sanitizedMedia = await sanitizeAvatarMedia(media);

			const storageKey = getAvatarStorageKey(activeUser.id);
			await storage.upload(storageKey, sanitizedMedia.file);
			const completedAt = new Date();

			const updatedUser = await repository.updateUserAvatarUrl(
				activeUser.id,
				storageKey,
				completedAt,
				completedAt
			);
			if (!updatedUser) {
				await storage.delete(storageKey).catch(() => {});
				throw new ArtworkFlowError(500, 'Avatar upload failed', 'PUBLISH_FAILED');
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
			const updatedUser = await repository.updateUserAvatarUrl(
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

			const existing = await repository.findUserById(targetUserId);
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
	storage: supabaseAvatarStorage
});
