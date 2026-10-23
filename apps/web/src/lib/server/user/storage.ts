import { createObjectStorage } from '#lib/server/media/object-storage.js';

const avatarObjectStorage = createObjectStorage({ notFoundMessage: 'Avatar not found' });

export const avatarStorage = avatarObjectStorage.storage;

export const streamAvatarStorageObject = avatarObjectStorage.stream;
