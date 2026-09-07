/*
 * The one way the browser talks to this app's JSON API.
 *
 * Six components used to re-invent fetch + parse + error, and they disagreed:
 * the admin dashboard sniffed `content-type`, the safety chips ran
 * `JSON.parse` inside a try, the detail panel used `json().catch(() => null)`,
 * and the gallery and the nav threw hardcoded copy that discarded the
 * `{ code, message }` the API had carefully written. Rate-limit and moderation
 * feedback was therefore invisible in exactly the places visitors hit it.
 *
 * Everything is a parameter rather than a closure over the global: components
 * that take a `request = fetch` prop (and SvelteKit load functions, which must
 * use `event.fetch`) pass theirs in.
 *
 * Credentials are deliberately left at fetch's own `same-origin` default rather
 * than pinned here: every URL this helper is given is a relative path to this
 * app, so the session cookie already rides along, and naming a mode would be
 * the one place in the codebase that could later be widened to `include` and
 * start sending the cookie somewhere else.
 */

/** A JSON API answer that was not `ok`. `code` is set only when the body carried one. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code?: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export type ApiRequestInit = {
	/** Overrides the global fetch — an injected spy, or SvelteKit's `event.fetch`. */
	fetch?: typeof fetch;
	/** Multipart body. Mutually exclusive with `json`; the browser sets its own content-type. */
	formData?: FormData;
	/** Extra request headers, merged over `accept`/`content-type`. */
	headers?: Record<string, string>;
	/** Serialized as the request body, with `content-type: application/json`. */
	json?: unknown;
	method?: string;
	signal?: AbortSignal;
};

type ApiErrorBody = {
	code?: unknown;
	message?: unknown;
};

/*
 * Never touches `response.headers`: some call sites' test doubles are bare
 * `{ ok, json }` objects, and a 204 or an HTML error page has to degrade to
 * `null` rather than throw a parser error over the real failure.
 */
const readJsonBody = async (response: Response) => {
	try {
		return (await response.json()) as unknown;
	} catch {
		return null;
	}
};

const toApiError = (status: number, body: unknown) => {
	const envelope = (typeof body === 'object' && body !== null ? body : {}) as ApiErrorBody;
	const code = typeof envelope.code === 'string' ? envelope.code : undefined;
	const message =
		typeof envelope.message === 'string' && envelope.message
			? envelope.message
			: `Request failed with status ${status}`;

	return new ApiError(status, message, code);
};

/**
 * Sends a JSON request and returns the parsed body, throwing `ApiError` when
 * the response is not `ok`. An aborted request rejects with the `AbortError`
 * the caller's signal produced, untouched.
 */
export const requestJson = async <T>(input: string, init: ApiRequestInit = {}): Promise<T> => {
	const headers: Record<string, string> = { accept: 'application/json' };

	if (init.json !== undefined) {
		headers['content-type'] = 'application/json';
	}

	const response = await (init.fetch ?? fetch)(input, {
		...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}),
		...(init.formData ? { body: init.formData } : {}),
		headers: { ...headers, ...init.headers },
		...(init.method ? { method: init.method } : {}),
		...(init.signal ? { signal: init.signal } : {})
	});

	const body = await readJsonBody(response);

	if (!response.ok) {
		throw toApiError(response.status, body);
	}

	return body as T;
};

/**
 * The server's own wording, but only when the answer really was this API
 * explaining itself to a visitor — a `{ code, message }` envelope on a 4xx.
 * A 5xx, a proxy's HTML error page or a dropped connection keeps the house
 * copy, so 'Internal Server Error' never reaches the gallery wall.
 */
export const apiErrorMessage = (error: unknown, fallback: string) =>
	error instanceof ApiError && error.code && error.status < 500 ? error.message : fallback;
