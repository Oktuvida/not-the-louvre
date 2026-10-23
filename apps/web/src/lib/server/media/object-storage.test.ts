import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import type { AppBucket } from '#lib/server/platform.js';
import { createObjectStorage } from './object-storage';

// wrangler's local emulation of the BUCKET bucket, the same one `wrangler dev`
// serves the e2e suite from.
const platform = vi.hoisted(() => ({ bucket: undefined as unknown }));
vi.mock('#lib/server/platform.js', () => ({
	appBucket: () => platform.bucket
}));

describe('media object storage', () => {
	let proxy: PlatformProxy<{ BUCKET: AppBucket }>;
	const { storage, stream } = createObjectStorage({ notFoundMessage: 'Artwork media not found' });

	beforeAll(async () => {
		proxy = await getPlatformProxy<{ BUCKET: AppBucket }>({ persist: false });
	});

	afterEach(() => {
		platform.bucket = proxy.env.BUCKET;
	});

	afterAll(async () => {
		await proxy.dispose();
	});

	it('streams back what was uploaded, with its content type', async () => {
		platform.bucket = proxy.env.BUCKET;
		const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);

		await storage.upload(
			'artworks/user-1/a.webp',
			new File([bytes], 'a.webp', { type: 'image/webp' })
		);
		const response = await stream('artworks/user-1/a.webp');

		expect(response.headers.get('content-type')).toBe('image/webp');
		expect(response.headers.get('content-length')).toBe(String(bytes.byteLength));
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
	});

	it("answers a missing object with the caller's not-found error", async () => {
		platform.bucket = proxy.env.BUCKET;

		await expect(stream('artworks/user-1/missing.webp')).rejects.toMatchObject({
			code: 'NOT_FOUND',
			message: 'Artwork media not found',
			status: 404
		});
	});

	it('deletes an object, and treats deleting a missing one as done', async () => {
		platform.bucket = proxy.env.BUCKET;
		await storage.upload('avatars/user-1/b.webp', new File([new Uint8Array([1])], 'b.webp'));

		await storage.delete('avatars/user-1/b.webp');
		await storage.delete('avatars/user-1/b.webp');

		await expect(stream('avatars/user-1/b.webp')).rejects.toMatchObject({ status: 404 });
	});

	it('fails as a storage error when the bucket binding is missing', async () => {
		platform.bucket = undefined;

		await expect(
			storage.upload('artworks/user-1/c.webp', new File([new Uint8Array([1])], 'c.webp'))
		).rejects.toMatchObject({ code: 'STORAGE_FAILED', status: 500 });
	});
});
