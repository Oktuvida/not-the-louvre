import { env } from '$env/dynamic/private';
import { ARTWORK_STORAGE_BUCKET } from './config';
import { ArtworkFlowError } from './errors';
import type { ArtworkStorage } from './types';

const getStorageConfig = () => {
	const baseUrl = env.SUPABASE_PUBLIC_URL;
	const serviceKey = env.SUPABASE_SECRET_KEY || env.SERVICE_ROLE_KEY;

	if (!baseUrl || !serviceKey) {
		throw new ArtworkFlowError(
			500,
			'Missing storage configuration for artwork publishing',
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

export const supabaseArtworkStorage: ArtworkStorage = {
	async upload(key, file) {
		const { baseUrl, bucket, serviceKey } = getStorageConfig();
		const response = await fetch(
			`${baseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
			{
				body: await file.arrayBuffer(),
				headers: {
					authorization: `Bearer ${serviceKey}`,
					'content-type': file.type,
					'x-upsert': 'false'
				},
				method: 'POST'
			}
		);

		if (!response.ok) {
			await toStorageError(response, 'Artwork media upload failed');
		}
	},
	async delete(key) {
		const { baseUrl, bucket, serviceKey } = getStorageConfig();
		const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${key}`, {
			headers: {
				authorization: `Bearer ${serviceKey}`
			},
			method: 'DELETE'
		});

		if (!response.ok && response.status !== 404) {
			await toStorageError(response, 'Artwork media deletion failed');
		}
	}
};
