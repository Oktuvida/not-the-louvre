export const ARTWORK_TITLE_MAX_LENGTH = 100;
export const ARTWORK_MEDIA_MAX_BYTES = 100 * 1024;
export const ARTWORK_MEDIA_CONTENT_TYPE = 'image/avif';
export const ARTWORK_STORAGE_BUCKET = 'artworks';

export const ARTWORK_PUBLISH_RATE_LIMIT = {
	maxAttempts: 20,
	windowMs: 60 * 60 * 1000
} as const;

export const ARTWORK_VOTE_RATE_LIMIT = {
	maxAttempts: 60,
	windowMs: 60 * 60 * 1000
} as const;

export const ARTWORK_COMMENT_RATE_LIMIT = {
	maxAttempts: 10,
	windowMs: 60 * 60 * 1000
} as const;

export const ARTWORK_COMMENT_MAX_LENGTH = 500;
