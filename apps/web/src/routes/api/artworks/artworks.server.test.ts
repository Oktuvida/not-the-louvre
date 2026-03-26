import { describe, expect, it } from 'vitest';

describe('artwork publish endpoint', () => {
	it('rejects unauthenticated publish requests', async () => {
		const { POST } = await import('./+server');
		const formData = new FormData();
		formData.set('title', 'No session');
		formData.set(
			'media',
			new File([new Uint8Array([1, 2, 3])], 'artwork.avif', { type: 'image/avif' })
		);

		const response = await POST({
			locals: {},
			request: new Request('http://localhost/api/artworks', {
				body: formData,
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({
			code: 'UNAUTHENTICATED'
		});
	});
});
