export class ArtworkFlowError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code:
			| 'FORBIDDEN'
			| 'INVALID_COMMENT'
			| 'INVALID_CURSOR'
			| 'INVALID_LIMIT'
			| 'INVALID_MEDIA_FORMAT'
			| 'INVALID_SORT'
			| 'INVALID_TITLE'
			| 'INVALID_VOTE'
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
