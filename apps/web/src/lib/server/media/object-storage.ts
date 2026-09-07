import { env } from '$env/dynamic/private';
import { ARTWORK_STORAGE_BUCKET } from '$lib/server/artwork/config';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { ArtworkStorage } from '$lib/server/artwork/types';

type SupabaseObjectStorageOptions = {
	deleteFailedMessage: string;
	missingConfigMessage: string;
	notFoundMessage: string;
	readFailedMessage: string;
	uploadFailedMessage: string;
	// Published artwork media is immutable, so a colliding key must fail loudly;
	// an avatar is replaced in place under a stable key, so it upserts.
	upsert: boolean;
};

type SupabaseObjectStorage = {
	resetPlaywrightStorage: () => void;
	storage: ArtworkStorage;
	stream: (key: string) => Promise<Response>;
};

// Avatars live under their own key prefix inside the artwork bucket; a single
// bucket is deliberate, so both callers resolve the same one.
const getStorageConfig = (missingConfigMessage: string) => {
	const baseUrl = env.SUPABASE_PUBLIC_URL;
	const serviceKey = env.SUPABASE_SECRET_KEY || env.SERVICE_ROLE_KEY;

	if (!baseUrl || !serviceKey) {
		throw new ArtworkFlowError(500, missingConfigMessage, 'STORAGE_FAILED');
	}

	return { baseUrl, bucket: env.ARTWORK_STORAGE_BUCKET || ARTWORK_STORAGE_BUCKET, serviceKey };
};

const toStorageError = async (response: Response, fallback: string) => {
	let message = fallback;

	try {
		const body = (await response.json()) as { message?: string; error?: string };
		message = body.message || body.error || fallback;
	} catch {
		// ignore invalid json response bodies
	}

	throw new ArtworkFlowError(502, message, 'STORAGE_FAILED');
};

const toObjectUrl = (baseUrl: string, bucket: string, key: string) =>
	`${baseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;

export const createSupabaseObjectStorage = (
	options: SupabaseObjectStorageOptions
): SupabaseObjectStorage => {
	// One Map per caller so artwork media and avatars stay separate stores, as
	// they were when this was two copies of the same file. `__PLAYWRIGHT__` is a
	// build-time constant (vite.config.ts `define`), so Rollup drops both the
	// Map and every branch below from the production worker.
	const playwrightStorage = __PLAYWRIGHT__
		? new Map<string, { body: Uint8Array; contentType: string }>()
		: null;

	const resolveConfig = () => getStorageConfig(options.missingConfigMessage);

	const storage: ArtworkStorage = {
		async upload(key, file) {
			if (__PLAYWRIGHT__ && playwrightStorage) {
				playwrightStorage.set(key, {
					body: new Uint8Array(await file.arrayBuffer()),
					contentType: file.type
				});
				return;
			}

			const { baseUrl, bucket, serviceKey } = resolveConfig();
			const response = await fetch(toObjectUrl(baseUrl, bucket, key), {
				body: await file.arrayBuffer(),
				headers: {
					authorization: `Bearer ${serviceKey}`,
					'content-type': file.type,
					'x-upsert': options.upsert ? 'true' : 'false'
				},
				method: 'POST'
			});

			if (!response.ok) {
				await toStorageError(response, options.uploadFailedMessage);
			}
		},

		async delete(key) {
			if (__PLAYWRIGHT__ && playwrightStorage) {
				playwrightStorage.delete(key);
				return;
			}

			const { baseUrl, bucket, serviceKey } = resolveConfig();
			const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${key}`, {
				headers: {
					authorization: `Bearer ${serviceKey}`
				},
				method: 'DELETE'
			});

			if (!response.ok && response.status !== 404) {
				await toStorageError(response, options.deleteFailedMessage);
			}
		}
	};

	const stream = async (key: string) => {
		if (__PLAYWRIGHT__ && playwrightStorage) {
			const storedObject = playwrightStorage.get(key);

			if (!storedObject) {
				throw new ArtworkFlowError(404, options.notFoundMessage, 'NOT_FOUND');
			}

			return new Response(
				new Blob([Buffer.from(storedObject.body)], { type: storedObject.contentType }),
				{
					headers: {
						'content-type': storedObject.contentType
					}
				}
			);
		}

		const { baseUrl, bucket, serviceKey } = resolveConfig();
		const response = await fetch(toObjectUrl(baseUrl, bucket, key), {
			headers: {
				authorization: `Bearer ${serviceKey}`
			},
			method: 'GET'
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw new ArtworkFlowError(404, options.notFoundMessage, 'NOT_FOUND');
			}

			await toStorageError(response, options.readFailedMessage);
		}

		return response;
	};

	return {
		resetPlaywrightStorage: () => {
			playwrightStorage?.clear();
		},
		storage,
		stream
	};
};
