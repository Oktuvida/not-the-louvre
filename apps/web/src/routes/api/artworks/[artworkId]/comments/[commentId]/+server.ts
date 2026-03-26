import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { deleteArtworkComment } from '$lib/server/artwork/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json({ code: 'PUBLISH_FAILED', message: 'Artwork request failed' }, { status: 500 });
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const comment = await deleteArtworkComment(
			{ artworkId: event.params.artworkId, commentId: event.params.commentId },
			{ user: event.locals.user }
		);

		return json({ comment });
	} catch (error) {
		return toErrorResponse(error);
	}
};
