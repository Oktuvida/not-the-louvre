import type { RequestHandler } from './$types';
import { getRandomArtwork } from '#lib/server/artwork/read.service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';

const RANDOM_ERROR = {
	fallbackCode: 'RANDOM_FAILED',
	fallbackMessage: 'Failed to get random artwork',
	scope: 'random artwork'
};

export const GET: RequestHandler = async (event) => {
	try {
		const artwork = await getRandomArtwork({ user: event.locals.user });
		return Response.json({ artwork });
	} catch (error) {
		return toApiErrorResponse(error, RANDOM_ERROR);
	}
};
