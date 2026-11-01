import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { streamArtworkStorageObject } from '#lib/server/artwork/storage.js';
import { getArtworkTimelapse } from '#lib/server/artwork/timelapse.service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { timelapseCacheControl } from '../cache-control';

const BACKDROP_ERROR = {
	fallbackCode: 'ARTWORK_TIMELAPSE_FAILED',
	fallbackMessage: 'Artwork timelapse backdrop read failed',
	scope: 'artwork timelapse backdrop'
};

/** The copy of the parent image a fork was drawn over, kept with the fork. */
export const GET: RequestHandler = async (event) => {
	try {
		const timelapse = await getArtworkTimelapse(event.params.artworkId, {
			user: event.locals.user
		});
		if (!timelapse.backdropKey) {
			throw new ArtworkFlowError(404, 'Artwork has no backdrop', 'NOT_FOUND');
		}

		const upstream = await streamArtworkStorageObject(timelapse.backdropKey);
		const headers = new Headers(upstream.headers);
		headers.set('cache-control', timelapseCacheControl(timelapse.isHidden));

		return new Response(upstream.body, { headers, status: 200 });
	} catch (error) {
		return toApiErrorResponse(error, BACKDROP_ERROR);
	}
};
