export class ArtworkFlowError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code:
			| 'BANNED_USER'
			| 'DRAWING_DOCUMENT_TOO_LARGE'
			| 'DRAWING_RUNTIME_FAILED'
			| 'FORBIDDEN'
			| 'DUPLICATE_REPORT'
			| 'INVALID_DRAWING_DOCUMENT'
			| 'INVALID_COMMENT'
			| 'INVALID_FORK_PARENT'
			| 'INVALID_CURSOR'
			| 'INVALID_MEDIA_CONTENT'
			| 'INVALID_MEDIA_DIMENSIONS'
			| 'INVALID_LIMIT'
			| 'INVALID_MEDIA_FORMAT'
			| 'INVALID_POLICY_VERSION'
			| 'INVALID_ROLE'
			| 'INVALID_REPORT_TARGET'
			| 'INVALID_REPORT_REASON'
			| 'INVALID_SORT'
			| 'INVALID_WINDOW'
			| 'INVALID_TITLE'
			| 'INVALID_VOTE'
			| 'VALIDATION_ERROR'
			| 'MEDIA_TOO_LARGE'
			| 'NOT_FOUND'
			| 'PUBLISH_FAILED'
			| 'RATE_LIMITED'
			| 'STORAGE_FAILED'
			| 'UNAUTHENTICATED',
		options?: ErrorOptions
	) {
		super(message, options);
	}
}

export const logArtworkFlowFailure = (scope: string, error: unknown) => {
	const status = error instanceof ArtworkFlowError ? error.status : 500;
	if (status < 500) return;

	console.error(`[artwork] ${scope} failed (status ${status})`, error);
	// Workers Logs does not serialize the cause chain, so surface it explicitly.
	if (error instanceof Error && error.cause !== undefined) {
		console.error(`[artwork] ${scope} failure cause`, error.cause);
	}
};
