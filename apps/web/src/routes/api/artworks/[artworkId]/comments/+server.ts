import { json } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { createArtworkComment, listArtworkComments } from '$lib/server/artwork/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json({ code: 'PUBLISH_FAILED', message: 'Artwork request failed' }, { status: 500 });
};

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { body?: string };
		const comment = await createArtworkComment(
			{ artworkId: event.params.artworkId, body: body.body ?? '' },
			{ ipAddress: getIp(event.request, auth.options), user: event.locals.user }
		);

		return json({ comment }, { status: 201 });
	} catch (error) {
		return toErrorResponse(error);
	}
};

export const GET: RequestHandler = async (event) => {
	try {
		const comments = await listArtworkComments(event.params.artworkId);
		return json({ comments });
	} catch (error) {
		return toErrorResponse(error);
	}
};
