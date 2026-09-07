import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseObjectStorage } from './object-storage';

vi.mock('$env/dynamic/private', () => ({
	env: {
		ARTWORK_STORAGE_BUCKET: 'artworks',
		SUPABASE_PUBLIC_URL: 'https://storage.local',
		SUPABASE_SECRET_KEY: 'service-key'
	}
}));

const messages = {
	deleteFailedMessage: 'Artwork media deletion failed',
	missingConfigMessage: 'Missing storage configuration for artwork publishing',
	notFoundMessage: 'Artwork media not found',
	readFailedMessage: 'Artwork media read failed',
	uploadFailedMessage: 'Artwork media upload failed'
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('supabase object storage client', () => {
	it('sends immutable uploads with x-upsert false and replaceable ones with true', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

		const immutable = createSupabaseObjectStorage({ ...messages, upsert: false });
		const replaceable = createSupabaseObjectStorage({ ...messages, upsert: true });

		await immutable.storage.upload(
			'artworks/user-1/artwork-1.avif',
			new File([new Uint8Array([1])], 'artwork.avif', { type: 'image/avif' })
		);
		await replaceable.storage.upload(
			'avatars/user-1.avif',
			new File([new Uint8Array([1])], 'avatar.avif', { type: 'image/avif' })
		);

		const [immutableRequest, replaceableRequest] = fetchMock.mock.calls;
		expect(immutableRequest?.[0]).toBe(
			'https://storage.local/storage/v1/object/artworks/artworks/user-1/artwork-1.avif'
		);
		expect((immutableRequest?.[1]?.headers as Record<string, string>)['x-upsert']).toBe('false');
		expect((replaceableRequest?.[1]?.headers as Record<string, string>)['x-upsert']).toBe('true');
	});

	it('maps a storage 404 on read to the caller not-found message', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

		const objectStorage = createSupabaseObjectStorage({ ...messages, upsert: false });

		await expect(objectStorage.stream('artworks/user-1/missing.avif')).rejects.toMatchObject({
			code: 'NOT_FOUND',
			message: 'Artwork media not found',
			status: 404
		});
	});

	it('surfaces the storage error body on a failed upload', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ message: 'duplicate key' }), { status: 409 })
		);

		const objectStorage = createSupabaseObjectStorage({ ...messages, upsert: false });

		await expect(
			objectStorage.storage.upload(
				'artworks/user-1/artwork-1.avif',
				new File([new Uint8Array([1])], 'artwork.avif', { type: 'image/avif' })
			)
		).rejects.toMatchObject({ code: 'STORAGE_FAILED', message: 'duplicate key', status: 502 });
	});

	it('swallows a 404 on delete but reports other failures', async () => {
		const objectStorage = createSupabaseObjectStorage({ ...messages, upsert: false });

		fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
		await expect(
			objectStorage.storage.delete('artworks/user-1/gone.avif')
		).resolves.toBeUndefined();

		fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
		await expect(objectStorage.storage.delete('artworks/user-1/gone.avif')).rejects.toMatchObject({
			code: 'STORAGE_FAILED',
			message: 'Artwork media deletion failed'
		});
	});

	it('keeps the Playwright in-memory store out of the default build', () => {
		// The production and unit-test builds compile with __PLAYWRIGHT__ false,
		// so no request may ever be served from the in-memory map.
		expect(__PLAYWRIGHT__).toBe(false);
	});
});
