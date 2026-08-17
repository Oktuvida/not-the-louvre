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

// Diagnostic fields postgres.js and drizzle attach to their errors.
const ERROR_DETAIL_KEYS = [
	'code',
	'column_name',
	'constraint_name',
	'detail',
	'hint',
	'position',
	'query',
	'severity',
	'table_name',
	'where'
] as const;

const MAX_DETAIL_LENGTH = 600;
const MAX_CAUSE_CHAIN_DEPTH = 5;

const truncateDetail = (value: string) =>
	value.length > MAX_DETAIL_LENGTH ? `${value.slice(0, MAX_DETAIL_LENGTH)}…` : value;

const describeError = (error: unknown): Record<string, string> => {
	if (!(error instanceof Error)) {
		// Keep the same shape as the Error branch so chain[].message is reliable.
		return { message: truncateDetail(String(error)), name: 'non-error' };
	}

	const described: Record<string, string> = {
		message: error.message,
		name: error.name
	};

	for (const key of ERROR_DETAIL_KEYS) {
		const value = (error as unknown as Record<string, unknown>)[key];
		if (typeof value === 'string' || typeof value === 'number') {
			described[key] = truncateDetail(String(value));
		}
	}

	return described;
};

export const logArtworkFlowFailure = (scope: string, error: unknown) => {
	const status = error instanceof ArtworkFlowError ? error.status : 500;
	if (status < 500) return;

	// Workers Logs drops the message line of Error objects and never serializes
	// the cause chain, so flatten everything into a plain JSON string.
	const chain: Record<string, string>[] = [];
	let current: unknown = error;
	while (current !== undefined && chain.length < MAX_CAUSE_CHAIN_DEPTH) {
		chain.push(describeError(current));
		current = current instanceof Error ? current.cause : undefined;
	}

	console.error(
		JSON.stringify({ category: 'artwork', chain, scope, status }),
		...(error instanceof Error && error.stack ? [error.stack] : [])
	);
};
