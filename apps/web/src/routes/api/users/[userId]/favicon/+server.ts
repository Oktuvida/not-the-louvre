import type { RequestHandler } from './$types';
import { etagMatches, notModified } from '#lib/server/http/conditional.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { renderAvatarFavicon } from '#lib/server/render/client.js';
import { userRepository } from '#lib/server/user/repository.js';
import { streamAvatarStorageObject } from '#lib/server/user/storage.js';
import { edgeCache, runAfterResponse } from '#lib/server/platform.js';

// Mirrors the avatar endpoint: short browser TTL, longer edge TTL. The edge
// copy also skips re-rendering the PNG, which runs on Worker CPU per request.
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';

const FAVICON_READ_ERROR = {
	fallbackCode: 'AVATAR_READ_FAILED',
	fallbackMessage: 'Avatar media read failed',
	scope: 'avatar favicon read'
};

export const GET: RequestHandler = async (event) => {
	try {
		const cache = edgeCache();

		const cachedResponse = await cache?.match(event.request.url);
		if (cachedResponse) {
			const cachedEtag = cachedResponse.headers.get('etag');
			if (cachedEtag && etagMatches(event.request, cachedEtag)) {
				return notModified(cachedResponse.headers);
			}

			return cachedResponse;
		}

		const user = await userRepository.findUserAvatarRefById(event.params.userId);

		if (!user || !user.avatarUrl) {
			return Response.json({ code: 'NOT_FOUND', message: 'Avatar not found' }, { status: 404 });
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
		const favicon = await renderAvatarFavicon(new Uint8Array(await upstream.arrayBuffer()));
		headers.set('content-length', String(favicon.byteLength));

		const response = new Response(Uint8Array.from(favicon), { headers, status: 200 });

		if (cache) {
			const cachePut = cache.put(event.request.url, response.clone()).catch(() => {});
			runAfterResponse(cachePut);
		}

		return response;
	} catch (error) {
		return toApiErrorResponse(error, FAVICON_READ_ERROR);
	}
};
