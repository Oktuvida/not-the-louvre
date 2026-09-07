import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRandomArtwork } from '$lib/server/artwork/read.service';
import { toApiErrorResponse } from '$lib/server/http/errors';

const RANDOM_ERROR = {
	fallbackCode: 'RANDOM_FAILED',
	fallbackMessage: 'Failed to get random artwork',
	scope: 'random artwork'
};

export const GET: RequestHandler = async (event) => {
	try {
		const artwork = await getRandomArtwork({ user: event.locals.user });
		return json({ artwork });
	} catch (error) {
		return toApiErrorResponse(error, RANDOM_ERROR);
	}
};
