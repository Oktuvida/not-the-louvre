import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { getArtworkMedia } from '$lib/server/artwork/read.service';
import { streamArtworkStorageObject } from '$lib/server/artwork/storage';
import { etagMatches, notModified } from '$lib/server/http/conditional';

// Browsers may hold media forever (a storage key never changes after publish).
// The edge copy stays short-lived: cache.delete only reaches the local
// datacenter, so hiding an artwork can only wait out this TTL elsewhere.
const EDGE_TTL_SECONDS = 3600;
const CACHE_CONTROL = `public, max-age=31536000, immutable, s-maxage=${EDGE_TTL_SECONDS}`;

const toEtag = (storageKey: string) => `"${storageKey}"`;

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

		const media = await getArtworkMedia(event.params.artworkId, { user: event.locals.user });
		const etag = toEtag(media.storageKey);

		const headers = new Headers();
		headers.set('content-type', media.mediaContentType);
		headers.set('cache-control', CACHE_CONTROL);
		headers.set('etag', etag);

		if (etagMatches(event.request, etag)) {
			return notModified(headers);
		}

		const upstream = await streamArtworkStorageObject(media.storageKey);
		const contentLength = upstream.headers.get('content-length');
		if (contentLength && !upstream.headers.get('content-encoding')) {
			headers.set('content-length', contentLength);
		}

		const response = new Response(upstream.body, {
			headers,
			status: 200
		});

		if (edgeCache) {
			const cachePut = edgeCache.put(event.request.url, response.clone()).catch(() => {});
			event.platform?.context?.waitUntil(cachePut);
		}

		return response;
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return new Response(error.message, { status: error.status });
		}

		return new Response('Artwork media read failed', { status: 500 });
	}
};
