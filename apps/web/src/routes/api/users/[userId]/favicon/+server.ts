import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { etagMatches, notModified } from '$lib/server/http/conditional';
import { renderAvatarFaviconPng } from '$lib/server/user/favicon';
import { userRepository } from '$lib/server/user/repository';
import { streamAvatarStorageObject } from '$lib/server/user/storage';

// Mirrors the avatar endpoint: short browser TTL, longer edge TTL. The edge
// copy also skips re-rendering the PNG, which runs on Worker CPU per request.
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';

const toErrorResponse = (error: unknown, fallback: { code: string; message: string }) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json(fallback, { status: 500 });
};

export const GET: RequestHandler = async (event) => {
	try {
		const edgeCache = event.platform?.caches?.default;

		const cachedResponse = await edgeCache?.match(event.request.url);
		if (cachedResponse) {
			const cachedEtag = cachedResponse.headers.get('etag');
			if (cachedEtag && etagMatches(event.request, cachedEtag)) {
				return notModified(cachedResponse.headers);
			}

			return cachedResponse;
		}

		const user = await userRepository.findUserById(event.params.userId);

		if (!user || !user.avatarUrl) {
			return json({ code: 'NOT_FOUND', message: 'Avatar not found' }, { status: 404 });
		}

		const etag = `"${user.avatarUrl}:${user.updatedAt.getTime()}:favicon"`;

		const headers = new Headers();
		headers.set('cache-control', CACHE_CONTROL);
		headers.set('content-type', 'image/png');
		headers.set('etag', etag);

		if (etagMatches(event.request, etag)) {
			return notModified(headers);
		}

		const upstream = await streamAvatarStorageObject(user.avatarUrl);
		const sourceBuffer = Buffer.from(await upstream.arrayBuffer());
		const faviconBuffer = await renderAvatarFaviconPng(sourceBuffer);
		headers.set('content-length', String(faviconBuffer.length));

		const response = new Response(new Uint8Array(faviconBuffer), { headers, status: 200 });

		if (edgeCache) {
			const cachePut = edgeCache.put(event.request.url, response.clone()).catch(() => {});
			event.platform?.context?.waitUntil(cachePut);
		}

		return response;
	} catch (error) {
		return toErrorResponse(error, {
			code: 'AVATAR_READ_FAILED',
			message: 'Avatar media read failed'
		});
	}
};
