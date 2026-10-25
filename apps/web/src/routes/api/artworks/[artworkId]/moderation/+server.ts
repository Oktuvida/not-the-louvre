import type { RequestHandler } from './$types';
import { moderateArtwork, withoutDrawingDocument } from '#lib/server/artwork/service.js';
import { artworkDetailEdgeCacheKeys, purgeFromEdgeCache } from '#lib/server/http/edge-cache.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { edgeCache } from '#lib/server/platform.js';

const MODERATION_ERROR = {
	fallbackCode: 'MODERATION_FAILED',
	fallbackMessage: 'Artwork moderation failed',
	scope: 'artwork moderation'
};

/*
 * A hide that leaves the artwork readable is not a hide. The anonymous detail
 * payload is shared at the edge, so hiding, deleting or reclassifying one has
 * to drop that copy — locally, which is where the moderator's own next request
 * lands; elsewhere the endpoint's short `s-maxage` retires it.
 */
const purgeArtworkDetailEdgeCache = (event: Parameters<RequestHandler>[0]) => {
	if (!edgeCache()) return;
	purgeFromEdgeCache(artworkDetailEdgeCacheKeys(event.url.origin, event.params.artworkId));
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as {
			action?: 'clear_nsfw' | 'dismiss' | 'hide' | 'mark_nsfw' | 'unhide';
		};
		const artwork = await moderateArtwork(
			{ action: body.action ?? 'hide', artworkId: event.params.artworkId },
			{ user: event.locals.user }
		);

		purgeArtworkDetailEdgeCache(event);

		return Response.json({ artwork: withoutDrawingDocument(artwork) });
	} catch (error) {
		return toApiErrorResponse(error, MODERATION_ERROR);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const artwork = await moderateArtwork(
			{ action: 'delete', artworkId: event.params.artworkId },
			{ user: event.locals.user }
		);

		purgeArtworkDetailEdgeCache(event);

		return Response.json({ artwork: withoutDrawingDocument(artwork) });
	} catch (error) {
		return toApiErrorResponse(error, MODERATION_ERROR);
	}
};
