import { describe, expect, it, vi } from 'vitest';
import { supabaseObjectSource } from './supabase-source';

const answer = (body: BodyInit | null, status: number, contentType = 'application/json') =>
	new Response(body, { headers: { 'content-type': contentType }, status });

const sourceAnswering = (response: Response) => {
	const request = vi.fn<typeof fetch>().mockResolvedValue(response);
	const source = supabaseObjectSource({
		bucket: 'artworks',
		key: 'sb_secret_example',
		request,
		url: 'https://project.supabase.co'
	});
	return { request, source };
};

describe('reading an image out of Supabase Storage for the cutover', () => {
	it('hands over the image, its key on both headers as the Supabase client sends it', async () => {
		const { request, source } = sourceAnswering(
			answer(new Uint8Array([1, 2, 3]), 200, 'image/avif')
		);

		const object = await source.read('artworks/artist one/picture.avif');

		expect(object).toEqual({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/avif' });
		expect(request).toHaveBeenCalledWith(
			'https://project.supabase.co/storage/v1/object/artworks/artworks/artist%20one/picture.avif',
			{
				headers: { apikey: 'sb_secret_example', authorization: 'Bearer sb_secret_example' }
			}
		);
	});

	it('reports an image Storage no longer has', async () => {
		const { source } = sourceAnswering(answer(null, 404));

		await expect(source.read('gone.avif')).resolves.toBeNull();
	});

	it('reports an image Storage says is gone in the body of a 400', async () => {
		const { source } = sourceAnswering(
			answer(JSON.stringify({ error: 'not_found', statusCode: '404' }), 400)
		);

		await expect(source.read('gone.avif')).resolves.toBeNull();
	});

	it('never takes a refused key for a missing image', async () => {
		const { source } = sourceAnswering(
			answer(
				JSON.stringify({ error: 'InvalidJWT', message: 'Invalid Compact JWS', statusCode: '403' }),
				400
			)
		);

		await expect(source.read('picture.avif')).rejects.toThrow('Supabase Storage answered 400');
	});

	it('stops on any other failure', async () => {
		const { source } = sourceAnswering(answer('Bad gateway', 502, 'text/plain'));

		await expect(source.read('picture.avif')).rejects.toThrow('Supabase Storage answered 502');
	});
});
