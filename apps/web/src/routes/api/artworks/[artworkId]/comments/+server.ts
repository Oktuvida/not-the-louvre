import { getIp } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '#lib/server/auth.js';
import { listArtworkCommentsForViewer } from '#lib/server/artwork/read.service.js';
import { createArtworkComment } from '#lib/server/artwork/service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';

const COMMENT_CREATE_ERROR = {
	fallbackCode: 'COMMENT_FAILED',
	fallbackMessage: 'Artwork comment failed',
	scope: 'artwork comment create'
};

const COMMENT_LIST_ERROR = {
	fallbackCode: 'COMMENT_LISTING_FAILED',
	fallbackMessage: 'Artwork comment listing failed',
	scope: 'artwork comment listing'
};

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { body?: string };
		const comment = await createArtworkComment(
			{ artworkId: event.params.artworkId, body: body.body ?? '' },
			{ ipAddress: getIp(event.request, auth.options), user: event.locals.user }
		);

		return Response.json({ comment }, { status: 201 });
	} catch (error) {
		return toApiErrorResponse(error, COMMENT_CREATE_ERROR);
	}
};

export const GET: RequestHandler = async (event) => {
	try {
		const comments = await listArtworkCommentsForViewer(event.params.artworkId, {
			user: event.locals.user
		});
		return Response.json({ comments });
	} catch (error) {
		return toApiErrorResponse(error, COMMENT_LIST_ERROR);
	}
};
