import { AVATAR_STORAGE_KEY_PREFIX } from './config';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
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
			if (!user) {
				throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
			}

			const sanitizedMedia = await sanitizeAvatarMedia(media);

			const storageKey = getAvatarStorageKey(user.id);
			await storage.upload(storageKey, sanitizedMedia.file);

			const updatedUser = await repository.updateUserAvatarUrl(user.id, storageKey, new Date());
			if (!updatedUser) {
				await storage.delete(storageKey).catch(() => {});
				throw new ArtworkFlowError(500, 'Avatar upload failed', 'PUBLISH_FAILED');
			}

			return updatedUser;
		},

		async deleteAvatar(user: CanonicalUser | null): Promise<UserRecord> {
			if (!user) {
				throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
			}

			const record = await repository.findUserById(user.id);
			if (!record) {
				throw new ArtworkFlowError(404, 'User not found', 'NOT_FOUND');
			}

			if (!record.avatarUrl) {
				return record;
			}

			const storageKey = record.avatarUrl;
			const updatedUser = await repository.updateUserAvatarUrl(user.id, null, new Date());
			if (!updatedUser) {
				throw new ArtworkFlowError(500, 'Avatar deletion failed', 'PUBLISH_FAILED');
			}

			await storage.delete(storageKey).catch(() => {});

			return updatedUser;
		}
	};
};

export const avatarService = createAvatarService({
	repository: userRepository,
	storage: supabaseAvatarStorage
});
