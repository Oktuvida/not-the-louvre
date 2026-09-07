import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { AuthFlowError } from '$lib/server/auth/errors';
import { toActionFailure, toApiErrorResponse } from './errors';

const silenceErrorLog = () => vi.spyOn(console, 'error').mockImplementation(() => {});

const apiOptions = {
	fallbackCode: 'VOTE_FAILED',
	fallbackMessage: 'Vote failed',
	scope: 'artwork vote'
};

describe('toApiErrorResponse', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('answers an ArtworkFlowError with its own status and code', async () => {
		const response = toApiErrorResponse(
			new ArtworkFlowError(429, 'Too many votes, slow down', 'RATE_LIMITED'),
			apiOptions
		);

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual({
			code: 'RATE_LIMITED',
			message: 'Too many votes, slow down'
		});
	});

	it('answers an AuthFlowError with its own status and code', async () => {
		const response = toApiErrorResponse(
			new AuthFlowError(401, 'Invalid nickname or password', 'INVALID_CREDENTIALS'),
			apiOptions
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			code: 'INVALID_CREDENTIALS',
			message: 'Invalid nickname or password'
		});
	});

	it('answers a duck-typed backend error carrying status, code and message', async () => {
		const response = toApiErrorResponse(
			{ code: 'NICKNAME_TAKEN', message: 'That nickname is taken', status: 409 },
			apiOptions
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			code: 'NICKNAME_TAKEN',
			message: 'That nickname is taken'
		});
	});

	it('answers anything else with the route fallback envelope, never the raw message', async () => {
		silenceErrorLog();

		const response = toApiErrorResponse(
			new Error('connection terminated unexpectedly'),
			apiOptions
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ code: 'VOTE_FAILED', message: 'Vote failed' });
	});

	it('gives every route the same JSON envelope for a non-error throw', async () => {
		silenceErrorLog();

		const response = toApiErrorResponse('boom', {
			fallbackCode: 'USER_LISTING_FAILED',
			fallbackMessage: 'User listing failed',
			scope: 'admin user listing'
		});

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			code: 'USER_LISTING_FAILED',
			message: 'User listing failed'
		});
	});

	it('logs a 500 once, with the scope', () => {
		const errorLog = silenceErrorLog();

		toApiErrorResponse(new ArtworkFlowError(500, 'Artwork publish failed', 'PUBLISH_FAILED'), {
			fallbackCode: 'PUBLISH_FAILED',
			fallbackMessage: 'Artwork publish failed',
			scope: 'artwork publish'
		});

		expect(errorLog).toHaveBeenCalledTimes(1);
		expect(String(errorLog.mock.calls[0]?.[0])).toContain('"scope":"artwork publish"');
	});

	it('keeps 4xx out of the error log, whichever error class carries them', () => {
		const errorLog = silenceErrorLog();

		toApiErrorResponse(new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND'), apiOptions);
		toApiErrorResponse(new AuthFlowError(429, 'Too many attempts', 'RATE_LIMITED'), apiOptions);
		toApiErrorResponse({ code: 'FORBIDDEN', message: 'Nope', status: 403 }, apiOptions);

		expect(errorLog).not.toHaveBeenCalled();
	});
});

describe('toActionFailure', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps the domain status, code and message of an AuthFlowError', () => {
		expect(
			toActionFailure(
				new AuthFlowError(401, 'Invalid nickname or password', 'INVALID_CREDENTIALS'),
				{
					extra: { action: 'signIn' },
					fallbackMessage: 'Sign in failed',
					scope: 'sign in action'
				}
			)
		).toMatchObject({
			status: 401,
			data: {
				action: 'signIn',
				code: 'INVALID_CREDENTIALS',
				message: 'Invalid nickname or password'
			}
		});
	});

	it('keeps the domain status, code and message of an ArtworkFlowError', () => {
		expect(
			toActionFailure(
				new ArtworkFlowError(400, 'Invalid drawing document', 'INVALID_DRAWING_DOCUMENT'),
				{
					extra: { action: 'publish' },
					fallbackMessage: 'Artwork publish failed',
					scope: 'publish action'
				}
			)
		).toMatchObject({
			status: 400,
			data: {
				action: 'publish',
				code: 'INVALID_DRAWING_DOCUMENT',
				message: 'Invalid drawing document'
			}
		});
	});

	it('accepts the duck-typed backend error the auth actions have always handled', () => {
		expect(
			toActionFailure(
				{ code: 'RATE_LIMITED', message: 'Too many attempts. Please wait.', status: 429 },
				{ fallbackMessage: 'Sign in failed', scope: 'sign in action' }
			)
		).toMatchObject({
			status: 429,
			data: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait.' }
		});
	});

	it('falls back to a 500 carrying the raw Error message, as the actions did', () => {
		silenceErrorLog();

		expect(
			toActionFailure(new Error('drizzle blew up'), {
				extra: { action: 'publish' },
				fallbackMessage: 'Artwork publish failed',
				scope: 'publish action'
			})
		).toMatchObject({
			status: 500,
			data: { action: 'publish', message: 'drizzle blew up' }
		});
	});

	it('uses the fallback message when the throw carries none', () => {
		silenceErrorLog();

		expect(
			toActionFailure('boom', {
				fallbackMessage: 'Artwork publish failed',
				scope: 'publish action'
			})
		).toMatchObject({
			status: 500,
			data: { message: 'Artwork publish failed' }
		});
	});

	it('leaves the code key out of the fallback payload', () => {
		silenceErrorLog();

		const failure = toActionFailure(new Error(''), {
			fallbackMessage: 'Artwork publish failed',
			scope: 'publish action'
		});

		expect(Object.keys(failure.data)).toEqual(['message']);
	});
});
