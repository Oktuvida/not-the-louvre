import { env } from '$env/dynamic/private';
import { ARTWORK_STORAGE_BUCKET } from '$lib/server/artwork/config';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { ArtworkStorage } from '$lib/server/artwork/types';

const playwrightAvatarStorage = new Map<string, { body: Uint8Array; contentType: string }>();

const isPlaywrightStorageRuntime = () => process.env.PLAYWRIGHT === '1';

export const resetPlaywrightAvatarStorage = () => {
	playwrightAvatarStorage.clear();
};

const getStorageConfig = () => {
	const baseUrl = env.SUPABASE_PUBLIC_URL;
	const serviceKey = env.SUPABASE_SECRET_KEY || env.SERVICE_ROLE_KEY;

	if (!baseUrl || !serviceKey) {
		throw new ArtworkFlowError(
			500,
			'Missing storage configuration for avatar upload',
			'STORAGE_FAILED'
		);
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

export const supabaseAvatarStorage: ArtworkStorage = {
	async upload(key, file) {
		if (isPlaywrightStorageRuntime()) {
			playwrightAvatarStorage.set(key, {
				body: new Uint8Array(await file.arrayBuffer()),
				contentType: file.type
			});
			return;
		}

		const { baseUrl, bucket, serviceKey } = getStorageConfig();
		const response = await fetch(
			`${baseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
			{
				body: await file.arrayBuffer(),
				headers: {
					authorization: `Bearer ${serviceKey}`,
					'content-type': file.type,
					'x-upsert': 'true'
				},
				method: 'POST'
			}
		);

		if (!response.ok) {
			await toStorageError(response, 'Avatar media upload failed');
		}
	},

	async delete(key) {
		if (isPlaywrightStorageRuntime()) {
			playwrightAvatarStorage.delete(key);
			return;
		}

		const { baseUrl, bucket, serviceKey } = getStorageConfig();
		const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${key}`, {
			headers: {
				authorization: `Bearer ${serviceKey}`
			},
			method: 'DELETE'
		});

		if (!response.ok && response.status !== 404) {
			await toStorageError(response, 'Avatar media deletion failed');
		}
	}
};

export const streamAvatarStorageObject = async (key: string) => {
	if (isPlaywrightStorageRuntime()) {
		const storedObject = playwrightAvatarStorage.get(key);

		if (!storedObject) {
			throw new ArtworkFlowError(404, 'Avatar not found', 'NOT_FOUND');
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

	const { baseUrl, bucket, serviceKey } = getStorageConfig();
	const response = await fetch(
		`${baseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
		{
			headers: {
				authorization: `Bearer ${serviceKey}`
			},
			method: 'GET'
		}
	);

	if (!response.ok) {
		if (response.status === 404) {
			throw new ArtworkFlowError(404, 'Avatar not found', 'NOT_FOUND');
		}

		await toStorageError(response, 'Avatar media read failed');
	}

	return response;
};
