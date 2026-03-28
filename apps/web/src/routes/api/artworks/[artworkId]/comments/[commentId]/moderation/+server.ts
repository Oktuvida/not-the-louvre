import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { moderateComment } from '$lib/server/artwork/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json({ code: 'PUBLISH_FAILED', message: 'Artwork request failed' }, { status: 500 });
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
		return toErrorResponse(error);
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
		return toErrorResponse(error);
	}
};
