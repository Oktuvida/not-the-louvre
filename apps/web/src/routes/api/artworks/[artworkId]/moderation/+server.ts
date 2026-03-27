import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { moderateArtwork } from '$lib/server/artwork/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json({ code: 'PUBLISH_FAILED', message: 'Artwork request failed' }, { status: 500 });
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { action?: 'hide' | 'unhide' };
		const artwork = await moderateArtwork(
			{ action: body.action ?? 'hide', artworkId: event.params.artworkId },
			{ user: event.locals.user }
		);

		return json({ artwork });
	} catch (error) {
		return toErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const artwork = await moderateArtwork(
			{ action: 'delete', artworkId: event.params.artworkId },
			{ user: event.locals.user }
		);

		return json({ artwork });
	} catch (error) {
		return toErrorResponse(error);
	}
};
