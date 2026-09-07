import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moderateArtwork, withoutDrawingDocument } from '$lib/server/artwork/service';
import { toApiErrorResponse } from '$lib/server/http/errors';

const MODERATION_ERROR = {
	fallbackCode: 'MODERATION_FAILED',
	fallbackMessage: 'Artwork moderation failed',
	scope: 'artwork moderation'
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as {
			action?: 'clear_nsfw' | 'dismiss' | 'hide' | 'mark_nsfw' | 'unhide';
		};
		const artwork = await moderateArtwork(
			{ action: body.action ?? 'hide', artworkId: event.params.artworkId },
			{ user: event.locals.user }
		);

		return json({ artwork: withoutDrawingDocument(artwork) });
	} catch (error) {
		return toApiErrorResponse(error, MODERATION_ERROR);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const artwork = await moderateArtwork(
			{ action: 'delete', artworkId: event.params.artworkId },
			{ user: event.locals.user }
		);

		return json({ artwork: withoutDrawingDocument(artwork) });
	} catch (error) {
		return toApiErrorResponse(error, MODERATION_ERROR);
	}
};
