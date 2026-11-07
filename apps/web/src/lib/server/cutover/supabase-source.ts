import type { ObjectSource } from './cutover';

// Storage says a missing object with a 404, or with a 400 and the real code in
// the body. Every other 400 is a refusal, and must not pass for a missing image.
const isMissing = async (response: Response) => {
	if (response.status === 404) return true;
	if (response.status !== 400) return false;

	const body = (await response.json().catch(() => null)) as { statusCode?: string } | null;
	return body?.statusCode === '404';
};

export const supabaseObjectSource = (options: {
	bucket: string;
	key: string;
	request?: typeof fetch;
	url: string;
}): ObjectSource => {
	const request = options.request ?? fetch;

	return {
		async read(key) {
			const path = encodeURIComponent(key).replace(/%2F/g, '/');
			const response = await request(
				`${options.url}/storage/v1/object/${options.bucket}/${path}`,
				// Both, as supabase-js sends them: a secret key is not a JWT, so `apikey`
				// is the header that counts, and Storage also requires `authorization`.
				{ headers: { apikey: options.key, authorization: `Bearer ${options.key}` } }
			);
			if (await isMissing(response)) return null;
			if (!response.ok) throw new Error(`Supabase Storage answered ${response.status} for ${key}`);
			return {
				bytes: new Uint8Array(await response.arrayBuffer()),
				contentType: response.headers.get('content-type') ?? 'application/octet-stream'
			};
		}
	};
};
