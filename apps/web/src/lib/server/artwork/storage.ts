import { createSupabaseObjectStorage } from '#lib/server/media/object-storage.js';

const artworkObjectStorage = createSupabaseObjectStorage({
	deleteFailedMessage: 'Artwork media deletion failed',
	missingConfigMessage: 'Missing storage configuration for artwork publishing',
	notFoundMessage: 'Artwork media not found',
	readFailedMessage: 'Artwork media read failed',
	uploadFailedMessage: 'Artwork media upload failed',
	// Published artwork media is immutable: a colliding key must fail loudly.
	upsert: false
});

export const resetPlaywrightArtworkStorage = artworkObjectStorage.resetPlaywrightStorage;

export const supabaseArtworkStorage = artworkObjectStorage.storage;

export const streamArtworkStorageObject = artworkObjectStorage.stream;
