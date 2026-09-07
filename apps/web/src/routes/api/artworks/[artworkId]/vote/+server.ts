import { json } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';
import { applyArtworkVote, removeArtworkVote } from '$lib/server/artwork/service';
import { toApiErrorResponse } from '$lib/server/http/errors';
import type { ArtworkVoteValue } from '$lib/shared/content/votes';

const VOTE_ERROR = {
	fallbackCode: 'VOTE_FAILED',
	fallbackMessage: 'Artwork vote failed',
	scope: 'artwork vote'
};

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { value?: string };
		const result = await applyArtworkVote(
			{ artworkId: event.params.artworkId, value: body.value as ArtworkVoteValue },
			{ ipAddress: getIp(event.request, auth.options), user: event.locals.user }
		);

		return json(result);
	} catch (error) {
		return toApiErrorResponse(error, VOTE_ERROR);
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
		return toApiErrorResponse(error, VOTE_ERROR);
	}
};
