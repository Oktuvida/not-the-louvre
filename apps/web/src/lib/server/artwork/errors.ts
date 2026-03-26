export class ArtworkFlowError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code:
			| 'FORBIDDEN'
			| 'INVALID_MEDIA_FORMAT'
			| 'INVALID_TITLE'
			| 'MEDIA_TOO_LARGE'
			| 'NOT_FOUND'
			| 'PUBLISH_FAILED'
			| 'RATE_LIMITED'
			| 'STORAGE_FAILED'
			| 'UNAUTHENTICATED'
	) {
		super(message);
	}
}
