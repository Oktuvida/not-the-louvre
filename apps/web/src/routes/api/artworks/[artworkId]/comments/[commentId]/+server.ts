import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteArtworkComment } from '$lib/server/artwork/service';
import { toApiErrorResponse } from '$lib/server/http/errors';

const COMMENT_DELETE_ERROR = {
	fallbackCode: 'COMMENT_DELETE_FAILED',
	fallbackMessage: 'Artwork comment delete failed',
	scope: 'artwork comment delete'
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const comment = await deleteArtworkComment(
			{ artworkId: event.params.artworkId, commentId: event.params.commentId },
			{ user: event.locals.user }
		);

		return json({ comment });
	} catch (error) {
		return toApiErrorResponse(error, COMMENT_DELETE_ERROR);
	}
};
