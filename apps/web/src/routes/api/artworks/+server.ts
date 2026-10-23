import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listArtworkDiscovery } from '$lib/server/artwork/read.service';
import { edgeCacheControl, readEdgeCache, storeInEdgeCache } from '$lib/server/http/edge-cache';
import { toApiErrorResponse } from '$lib/server/http/errors';

// Anonymous discovery pages are viewer-independent: `viewerVote` collapses to a
// literal null and the visibility filter ignores the moderator flag, so every
// signed-out visitor gets the same bytes. Sharing them at the edge is gated on
// `locals.user` being null rather than on a `Vary` the Workers Cache API would
// not honour anyway, which makes a cross-viewer leak impossible by construction.
// Unlike the detail key, a listing cannot be purged at all: the query fan-out
// (sort, window, cursor, limit) is unbounded, so nothing can enumerate the keys
// a hide would have to drop. The TTL is the only bound there is, so it stays
// short.
const ANONYMOUS_EDGE_TTL_SECONDS = 30;
const ANONYMOUS_CACHE_CONTROL = edgeCacheControl(ANONYMOUS_EDGE_TTL_SECONDS, 120);
const SIGNED_IN_CACHE_CONTROL = 'private, no-store';

const DISCOVERY_ERROR = {
	fallbackCode: 'DISCOVERY_FAILED',
	fallbackMessage: 'Artwork discovery failed',
	scope: 'artwork discovery'
};

export const GET: RequestHandler = async (event) => {
	const isAnonymous = !event.locals.user;

	if (isAnonymous) {
		const cached = await readEdgeCache(event.platform, event.request);
		if (cached) return cached;
	}

	const authorId = event.url.searchParams.get('authorId');
	const sort = event.url.searchParams.get('sort') ?? 'recent';
	const window = event.url.searchParams.get('window');
	const cursor = event.url.searchParams.get('cursor');
	const limitValue = event.url.searchParams.get('limit');
	const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

	try {
		const discoveryRequest = {
			cursor,
			limit,
			sort: sort as never,
			window,
			...(authorId ? { authorId } : {})
		};

		const discovery = await listArtworkDiscovery(discoveryRequest, { user: event.locals.user });
		const response = json(discovery, {
			headers: {
				'cache-control': isAnonymous ? ANONYMOUS_CACHE_CONTROL : SIGNED_IN_CACHE_CONTROL
			}
		});

		if (isAnonymous) {
			storeInEdgeCache(event.platform, event.request, response);
		}

		return response;
	} catch (error) {
		return toApiErrorResponse(error, DISCOVERY_ERROR);
	}
};
