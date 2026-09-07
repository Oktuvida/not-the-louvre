import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getArtworkDetail } from '$lib/server/artwork/read.service';
import {
	artworkDetailEdgeCacheKeys,
	edgeCacheControl,
	purgeFromEdgeCache,
	readEdgeCache,
	storeInEdgeCache
} from '$lib/server/http/edge-cache';
import { toApiErrorResponse } from '$lib/server/http/errors';
import {
	deleteArtwork,
	updateArtworkTitle,
	withoutDrawingDocument
} from '$lib/server/artwork/service';

const TITLE_UPDATE_ERROR = {
	fallbackCode: 'ARTWORK_UPDATE_FAILED',
	fallbackMessage: 'Artwork update failed',
	scope: 'artwork title update'
};

const DELETE_ERROR = {
	fallbackCode: 'ARTWORK_DELETE_FAILED',
	fallbackMessage: 'Artwork delete failed',
	scope: 'artwork delete'
};

const DETAIL_ERROR = {
	fallbackCode: 'ARTWORK_DETAIL_FAILED',
	fallbackMessage: 'Artwork detail read failed',
	scope: 'artwork detail'
};

/*
 * Anything that changes what this artwork is — a retitle, a delete, a
 * moderation hide — drops the shared copy of it. Without this the anonymous
 * payload stored by GET below stays readable for the whole TTL after the row
 * has gone, which for a hide is exactly the wrong direction.
 */
const purgeArtworkDetailEdgeCache = (event: Parameters<RequestHandler>[0]) => {
	if (!event.platform?.caches?.default) return;

	purgeFromEdgeCache(
		event.platform,
		artworkDetailEdgeCacheKeys(event.url.origin, event.params.artworkId)
	);
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { title?: string };
		const artwork = await updateArtworkTitle(
			{
				artworkId: event.params.artworkId,
				title: body.title ?? ''
			},
			{ user: event.locals.user }
		);

		purgeArtworkDetailEdgeCache(event);

		return json({ artwork: withoutDrawingDocument(artwork) });
	} catch (error) {
		return toApiErrorResponse(error, TITLE_UPDATE_ERROR);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const artwork = await deleteArtwork(
			{ artworkId: event.params.artworkId },
			{ user: event.locals.user }
		);

		purgeArtworkDetailEdgeCache(event);

		return json({ artwork: withoutDrawingDocument(artwork) });
	} catch (error) {
		return toApiErrorResponse(error, DELETE_ERROR);
	}
};

// The anonymous detail payload is viewer-independent: `viewerVote` collapses to
// a literal null and the visibility filter ignores the moderator flag, so every
// signed-out visitor gets the same bytes. Sharing is gated on `locals.user`
// being null rather than on a `Vary` the Workers Cache API would not honour, so
// a cross-viewer leak is impossible by construction. Every write to this
// artwork purges the key (see above), but `caches.default.delete()` only
// reaches the local datacenter — which is where the moderator is. The TTL is
// what bounds a hidden artwork's readability in every other colo, so it stays
// short.
const ANONYMOUS_EDGE_TTL_SECONDS = 30;
const ANONYMOUS_CACHE_CONTROL = edgeCacheControl(ANONYMOUS_EDGE_TTL_SECONDS, 120);
const SIGNED_IN_CACHE_CONTROL = 'private, no-store';

export const GET: RequestHandler = async (event) => {
	const isAnonymous = !event.locals.user;

	if (isAnonymous) {
		const cached = await readEdgeCache(event.platform, event.request);
		if (cached) return cached;
	}

	try {
		const artwork = await getArtworkDetail(event.params.artworkId, { user: event.locals.user });
		const response = json(
			{ artwork: withoutDrawingDocument(artwork) },
			{
				headers: {
					'cache-control': isAnonymous ? ANONYMOUS_CACHE_CONTROL : SIGNED_IN_CACHE_CONTROL
				}
			}
		);

		if (isAnonymous) {
			storeInEdgeCache(event.platform, event.request, response);
		}

		return response;
	} catch (error) {
		return toApiErrorResponse(error, DETAIL_ERROR);
	}
};
