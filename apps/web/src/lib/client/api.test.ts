import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiErrorMessage, requestJson } from './api';

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json' },
		status
	});

describe('requestJson', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('asks for JSON and returns the parsed body', async () => {
		const fetchSpy = vi.fn(async () => jsonResponse({ items: ['one'] }));

		expect(await requestJson<{ items: string[] }>('/api/artworks', { fetch: fetchSpy })).toEqual({
			items: ['one']
		});
		expect(fetchSpy).toHaveBeenCalledWith('/api/artworks', {
			headers: { accept: 'application/json' }
		});
	});

	it('serializes a JSON body and declares its content type once', async () => {
		const fetchSpy = vi.fn(async () => jsonResponse({ ok: true }));

		await requestJson('/api/artworks/artwork-1/vote', {
			fetch: fetchSpy,
			json: { value: 'up' },
			method: 'POST'
		});

		expect(fetchSpy).toHaveBeenCalledWith('/api/artworks/artwork-1/vote', {
			body: JSON.stringify({ value: 'up' }),
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			method: 'POST'
		});
	});

	it('sends form data without inventing a content type for it', async () => {
		const fetchSpy = vi.fn(async () => jsonResponse({ avatarUrl: '/avatar' }));
		const formData = new FormData();
		formData.set('drawingDocument', '{}');

		await requestJson('/api/users/user-1/avatar', {
			fetch: fetchSpy,
			formData,
			method: 'PUT'
		});

		expect(fetchSpy).toHaveBeenCalledWith('/api/users/user-1/avatar', {
			body: formData,
			headers: { accept: 'application/json' },
			method: 'PUT'
		});
	});

	it('falls back to the global fetch when no override is given', async () => {
		const fetchSpy = vi.fn(async () => jsonResponse({ artwork: null }));
		vi.stubGlobal('fetch', fetchSpy);

		await requestJson('/api/artworks/random');

		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it('throws an ApiError carrying the status, code and message of the envelope', async () => {
		const fetchSpy = vi.fn(async () =>
			jsonResponse({ code: 'RATE_LIMITED', message: 'Slow down, artist.' }, 429)
		);

		const error = await requestJson('/api/artworks/artwork-1/comments', {
			fetch: fetchSpy,
			json: { body: 'hi' },
			method: 'POST'
		}).catch((thrown: unknown) => thrown);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			code: 'RATE_LIMITED',
			message: 'Slow down, artist.',
			status: 429
		});
	});

	it('leaves the code unset when the failure body is not the JSON envelope', async () => {
		const fetchSpy = vi.fn(
			async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })
		);

		const error = (await requestJson('/api/artworks', { fetch: fetchSpy }).catch(
			(thrown: unknown) => thrown
		)) as ApiError;

		expect(error).toBeInstanceOf(ApiError);
		expect(error.code).toBeUndefined();
		expect(error.status).toBe(502);
		expect(error.message).toBe('Request failed with status 502');
	});

	it('accepts a response double that only answers ok and json', async () => {
		const fetchSpy = vi.fn(async () => ({
			json: async () => ({ avatarUrl: '/avatars/user-1.png' }),
			ok: true
		}));

		expect(
			await requestJson<{ avatarUrl: string }>('/api/users/user-1/avatar', {
				fetch: fetchSpy as unknown as typeof fetch,
				method: 'PUT'
			})
		).toEqual({ avatarUrl: '/avatars/user-1.png' });
	});

	it('forwards an AbortSignal and lets its rejection through unwrapped', async () => {
		const controller = new AbortController();
		const fetchSpy = vi.fn(async (_input: string, requestInit?: RequestInit) => {
			expect(requestInit?.signal).toBe(controller.signal);
			controller.abort();

			throw new DOMException('The operation was aborted.', 'AbortError');
		});

		const error = (await requestJson('/api/artworks', {
			fetch: fetchSpy as unknown as typeof fetch,
			signal: controller.signal
		}).catch((thrown: unknown) => thrown)) as Error;

		expect(error).not.toBeInstanceOf(ApiError);
		expect(error.name).toBe('AbortError');
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it('omits the signal key entirely when the caller passes none', async () => {
		const fetchSpy = vi.fn(async () => jsonResponse({}));

		await requestJson('/api/artworks', { fetch: fetchSpy });

		const requestInit = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1];
		expect('signal' in requestInit).toBe(false);
		expect('body' in requestInit).toBe(false);
	});
});

describe('apiErrorMessage', () => {
	it('shows the API message when the envelope explained a client-side failure', () => {
		expect(
			apiErrorMessage(
				new ApiError(400, 'Comment must be between 1 and 500 characters', 'INVALID_COMMENT'),
				'Comment failed'
			)
		).toBe('Comment must be between 1 and 500 characters');
	});

	it('keeps the house copy for a 500, even when it carried a code', () => {
		expect(
			apiErrorMessage(new ApiError(500, 'Artwork request failed', 'PUBLISH_FAILED'), 'Vote failed')
		).toBe('Vote failed');
	});

	it('keeps the house copy when the body carried no code at all', () => {
		expect(apiErrorMessage(new ApiError(404, 'Not Found'), 'Artwork details failed')).toBe(
			'Artwork details failed'
		);
	});

	it('keeps the house copy for a network error that never reached the API', () => {
		expect(apiErrorMessage(new TypeError('Failed to fetch'), 'Gallery could not be loaded')).toBe(
			'Gallery could not be loaded'
		);
	});
});
