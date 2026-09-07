import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { getArtworkDetail } from '$lib/server/artwork/read.service';
import { edgeCacheControl, readEdgeCache, storeInEdgeCache } from '$lib/server/http/edge-cache';
import {
	deleteArtwork,
	updateArtworkTitle,
	withoutDrawingDocument
} from '$lib/server/artwork/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json({ code: 'PUBLISH_FAILED', message: 'Artwork request failed' }, { status: 500 });
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

		return json({ artwork: withoutDrawingDocument(artwork) });
	} catch (error) {
		return toErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const artwork = await deleteArtwork(
			{ artworkId: event.params.artworkId },
			{ user: event.locals.user }
		);

		return json({ artwork: withoutDrawingDocument(artwork) });
	} catch (error) {
		return toErrorResponse(error);
	}
};

// The anonymous detail payload is viewer-independent: `viewerVote` collapses to
// a literal null and the visibility filter ignores the moderator flag, so every
// signed-out visitor gets the same bytes. Sharing is gated on `locals.user`
// being null rather than on a `Vary` the Workers Cache API would not honour, so
// a cross-viewer leak is impossible by construction. The TTL is short because
// `caches.default.delete()` is colo-local: an artwork hidden by moderation
// would otherwise stay readable elsewhere for the window.
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
		return toErrorResponse(error);
	}
};
