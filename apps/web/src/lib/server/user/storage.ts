import { createSupabaseObjectStorage } from '#lib/server/media/object-storage.js';

const avatarObjectStorage = createSupabaseObjectStorage({
	deleteFailedMessage: 'Avatar media deletion failed',
	missingConfigMessage: 'Missing storage configuration for avatar upload',
	notFoundMessage: 'Avatar not found',
	readFailedMessage: 'Avatar media read failed',
	uploadFailedMessage: 'Avatar media upload failed',
	// An avatar key names its content, so saving the same picture again rewrites
	// the same bytes.
	upsert: true
});

export const resetPlaywrightAvatarStorage = avatarObjectStorage.resetPlaywrightStorage;

export const supabaseAvatarStorage = avatarObjectStorage.storage;

export const streamAvatarStorageObject = avatarObjectStorage.stream;
