import type { RequestHandler } from './$types';
import { getArtworkTimelapse } from '#lib/server/artwork/timelapse.service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { timelapseCacheControl } from './cache-control';

const TIMELAPSE_ERROR = {
	fallbackCode: 'ARTWORK_TIMELAPSE_FAILED',
	fallbackMessage: 'Artwork timelapse read failed',
	scope: 'artwork timelapse'
};

export const GET: RequestHandler = async (event) => {
	try {
		const timelapse = await getArtworkTimelapse(event.params.artworkId, {
			user: event.locals.user
		});

		return Response.json(
			{
				backdropUrl: timelapse.backdropKey
					? `/api/artworks/${event.params.artworkId}/timelapse/backdrop`
					: null,
				drawing: timelapse.drawing
			},
			{
				headers: { 'cache-control': timelapseCacheControl(timelapse.isHidden) }
			}
		);
	} catch (error) {
		return toApiErrorResponse(error, TIMELAPSE_ERROR);
	}
};
