import { createObjectStorage } from '#lib/server/media/object-storage.js';

const artworkObjectStorage = createObjectStorage({ notFoundMessage: 'Artwork media not found' });

export const artworkStorage = artworkObjectStorage.storage;

export const streamArtworkStorageObject = artworkObjectStorage.stream;
