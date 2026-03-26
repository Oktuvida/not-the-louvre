import { json } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { applyArtworkVote, removeArtworkVote } from '$lib/server/artwork/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json({ code: 'PUBLISH_FAILED', message: 'Artwork request failed' }, { status: 500 });
};

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { value?: string };
		const result = await applyArtworkVote(
			{ artworkId: event.params.artworkId, value: body.value as 'down' | 'up' },
			{ ipAddress: getIp(event.request, auth.options), user: event.locals.user }
		);

		return json(result);
	} catch (error) {
		return toErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const result = await removeArtworkVote(
			{ artworkId: event.params.artworkId },
			{ ipAddress: getIp(event.request, auth.options), user: event.locals.user }
		);

		return json(result);
	} catch (error) {
		return toErrorResponse(error);
	}
};
