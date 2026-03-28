export class ArtworkFlowError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code:
			| 'FORBIDDEN'
			| 'DUPLICATE_REPORT'
			| 'INVALID_COMMENT'
			| 'INVALID_FORK_PARENT'
			| 'INVALID_CURSOR'
			| 'INVALID_LIMIT'
			| 'INVALID_MEDIA_FORMAT'
			| 'INVALID_ROLE'
			| 'INVALID_REPORT_TARGET'
			| 'INVALID_REPORT_REASON'
			| 'INVALID_SORT'
			| 'INVALID_WINDOW'
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
