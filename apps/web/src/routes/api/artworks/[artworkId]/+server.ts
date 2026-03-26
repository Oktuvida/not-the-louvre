import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { getArtworkDetail } from '$lib/server/artwork/read.service';
import { deleteArtwork, updateArtworkTitle } from '$lib/server/artwork/service';

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

		return json({ artwork });
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

		return json({ artwork });
	} catch (error) {
		return toErrorResponse(error);
	}
};

export const GET: RequestHandler = async (event) => {
	try {
		const artwork = await getArtworkDetail(event.params.artworkId);
		return json({ artwork });
	} catch (error) {
		return toErrorResponse(error);
	}
};
