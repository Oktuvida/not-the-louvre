import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moderateComment } from '$lib/server/artwork/service';
import { toApiErrorResponse } from '$lib/server/http/errors';

const COMMENT_MODERATION_ERROR = {
	fallbackCode: 'MODERATION_FAILED',
	fallbackMessage: 'Comment moderation failed',
	scope: 'comment moderation'
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

		return json({ comment });
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

		return json({ comment });
	} catch (error) {
		return toApiErrorResponse(error, COMMENT_MODERATION_ERROR);
	}
};
