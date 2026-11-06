import type { RequestHandler } from './$types';
import { moderateComment } from '#lib/server/artwork/service.js';
import { artworkPageEdgeCacheKey, purgeFromEdgeCache } from '#lib/server/http/edge-cache.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { edgeCache } from '#lib/server/platform.js';

const COMMENT_MODERATION_ERROR = {
	fallbackCode: 'MODERATION_FAILED',
	fallbackMessage: 'Comment moderation failed',
	scope: 'comment moderation'
};

// The artwork's page shared among signed-out visitors carries its comments.
const purgeArtworkPageEdgeCache = (event: Parameters<RequestHandler>[0]) => {
	if (!edgeCache()) return;
	purgeFromEdgeCache([artworkPageEdgeCacheKey(event.url.origin, event.params.artworkId)]);
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { action?: 'dismiss' | 'hide' | 'unhide' };
		const comment = await moderateComment(
			{
				action: body.action ?? 'hide',
				artworkId: event.params.artworkId,
				commentId: event.params.commentId
			},
			{ user: event.locals.user }
		);

		purgeArtworkPageEdgeCache(event);

		return Response.json({ comment });
	} catch (error) {
		return toApiErrorResponse(error, COMMENT_MODERATION_ERROR);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const comment = await moderateComment(
			{
				action: 'delete',
				artworkId: event.params.artworkId,
				commentId: event.params.commentId
			},
			{ user: event.locals.user }
		);

		purgeArtworkPageEdgeCache(event);

		return Response.json({ comment });
	} catch (error) {
		return toApiErrorResponse(error, COMMENT_MODERATION_ERROR);
	}
};
