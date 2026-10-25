import type { RequestHandler } from './$types';
import { deleteArtworkComment } from '#lib/server/artwork/service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';

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

		return Response.json({ comment });
	} catch (error) {
		return toApiErrorResponse(error, COMMENT_DELETE_ERROR);
	}
};
