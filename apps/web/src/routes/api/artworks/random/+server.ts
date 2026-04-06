import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { getRandomArtwork } from '$lib/server/artwork/read.service';

export const GET: RequestHandler = async (event) => {
	try {
		const artwork = await getRandomArtwork({ user: event.locals.user });
		return json({ artwork });
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return json({ code: error.code, message: error.message }, { status: error.status });
		}

		return json(
			{ code: 'RANDOM_FAILED', message: 'Failed to get random artwork' },
			{ status: 500 }
		);
	}
};
