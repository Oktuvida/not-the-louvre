import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAdultContentEnabled, uploadViewerAvatar } from './avatar-upload';

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json' },
		status
	});

describe('uploadViewerAvatar', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('refuses to upload without a signed-in user instead of calling the API', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		expect(await uploadViewerAvatar(null, '{}')).toEqual({
			message: 'Your session is not ready for avatar upload. Please sign in again.',
			success: false
		});
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('PUTs the drawing document as form data and returns the stored avatar URL', async () => {
		const fetchSpy = vi.fn(async () =>
			jsonResponse({ avatarUrl: '/api/users/product-user-1/avatar?v=1711713600000' })
		);
		vi.stubGlobal('fetch', fetchSpy);

		const result = await uploadViewerAvatar('product-user-1', '{"version":2}');

		expect(result).toEqual({
			avatarUrl: '/api/users/product-user-1/avatar?v=1711713600000',
			success: true
		});
		expect(fetchSpy).toHaveBeenCalledWith('/api/users/product-user-1/avatar', {
			body: expect.any(FormData),
			method: 'PUT'
		});

		const fetchCalls = fetchSpy.mock.calls as unknown as Array<[string, RequestInit]>;
		const body = fetchCalls[0]?.[1].body as FormData;
		expect(body.get('drawingDocument')).toBe('{"version":2}');
	});

	it('treats a successful response without an avatar URL as a failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => jsonResponse({}))
		);

		expect(await uploadViewerAvatar('product-user-1', '{}')).toEqual({
			message: 'Avatar save succeeded but no avatar URL was returned.',
			success: false
		});
	});

	it('surfaces the API code and message when the upload is rejected', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => jsonResponse({ code: 'avatar_too_large', message: 'Too big.' }, 413))
		);

		expect(await uploadViewerAvatar('product-user-1', '{}')).toEqual({
			code: 'avatar_too_large',
			message: 'Too big.',
			success: false
		});
	});

	it('falls back to a generic message when the error body is not JSON', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('<html>502</html>', { status: 502 }))
		);

		expect(await uploadViewerAvatar('product-user-1', '{}')).toEqual({
			message: 'Avatar save failed. Please try again.',
			success: false
		});
	});
});

describe('setAdultContentEnabled', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('PATCHes the viewer content preference', async () => {
		const fetchSpy = vi.fn(async () => jsonResponse({ adultContentEnabled: true }));
		vi.stubGlobal('fetch', fetchSpy);

		await setAdultContentEnabled(true);

		expect(fetchSpy).toHaveBeenCalledWith('/api/viewer/content-preferences', {
			body: JSON.stringify({ adultContentEnabled: true }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
	});

	it('throws the shared message when the preference cannot be stored', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => jsonResponse({ message: 'nope' }, 500))
		);

		await expect(setAdultContentEnabled(false)).rejects.toThrow(
			'18+ artwork preference could not be updated.'
		);
	});
});
