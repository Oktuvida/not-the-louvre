import { fail, json } from '@sveltejs/kit';
import { ArtworkFlowError, logArtworkFlowFailure } from '$lib/server/artwork/errors';
import { AuthFlowError } from '$lib/server/auth/errors';

/*
 * The one place a thrown domain error becomes an HTTP answer.
 *
 * Fourteen JSON routes carried a private `toErrorResponse` copy and five page
 * actions carried a `toFailure` copy, which meant fourteen places to touch to
 * add logging and five slightly different duck-typed branches. Only
 * api/artworks/+server.ts ever logged, so every other endpoint's 500s were
 * invisible; both helpers below log once, on the way out.
 */

type ApiErrorOptions = {
	/** Code for a failure that is not a domain error. Never `'PUBLISH_FAILED'` outside publishing. */
	fallbackCode: string;
	/** Copy for a failure that is not a domain error. */
	fallbackMessage: string;
	/** What was being attempted; only reaches the log for 5xx. */
	scope: string;
};

type FlowFailure = {
	code: string;
	message: string;
	status: number;
};

/**
 * Better-auth's `APIError` and the two domain errors all answer the same three
 * questions, so the actions accepted a duck-typed shape long before this module
 * existed. Keeping that branch here is what lets `toActionFailure` replace all
 * five copies verbatim.
 */
const asFlowFailure = (error: unknown): FlowFailure | null => {
	if (error instanceof ArtworkFlowError || error instanceof AuthFlowError) {
		return { code: error.code, message: error.message, status: error.status };
	}

	if (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		'message' in error &&
		'code' in error
	) {
		const duckTyped = error as Pick<ArtworkFlowError, 'code' | 'message' | 'status'>;

		return { code: duckTyped.code, message: duckTyped.message, status: duckTyped.status };
	}

	return null;
};

/*
 * `logArtworkFlowFailure` reads the status off ArtworkFlowError alone, so an
 * AuthFlowError's own 401 would be logged as a 500 and a wrong password would
 * fill the error log. Gate on the real status before handing it over.
 */
const logServerFailure = (scope: string, error: unknown, failure: FlowFailure | null) => {
	if ((failure?.status ?? 500) < 500) return;

	logArtworkFlowFailure(scope, error);
};

/**
 * Domain error → its own status and `{ code, message }`; anything else → a 500
 * carrying the route's own fallback envelope, logged with the whole cause chain.
 */
export const toApiErrorResponse = (error: unknown, options: ApiErrorOptions) => {
	const failure = asFlowFailure(error);
	logServerFailure(options.scope, error, failure);

	if (failure) {
		return json({ code: failure.code, message: failure.message }, { status: failure.status });
	}

	return json({ code: options.fallbackCode, message: options.fallbackMessage }, { status: 500 });
};

type ActionFailureOptions<Extra extends Record<string, unknown>> = {
	/** Payload keys this action always carries, such as its `action` discriminator. */
	extra?: Extra;
	/** Copy for a failure that is neither a domain error nor an `Error`. */
	fallbackMessage: string;
	/** What was being attempted; only reaches the log for 5xx. */
	scope: string;
};

/**
 * The page-action twin of `toApiErrorResponse`: same triage, but the answer is
 * a `fail()` whose payload keeps whatever discriminator the action already sent
 * back (`action: 'publish'`, and so on).
 */
export const toActionFailure = <Extra extends Record<string, unknown>>(
	error: unknown,
	options: ActionFailureOptions<Extra>
) => {
	const failure = asFlowFailure(error);
	logServerFailure(options.scope, error, failure);

	if (failure) {
		return fail(failure.status, {
			...options.extra,
			code: failure.code,
			message: failure.message
		});
	}

	return fail(500, {
		...options.extra,
		message: error instanceof Error && error.message ? error.message : options.fallbackMessage
	});
};
