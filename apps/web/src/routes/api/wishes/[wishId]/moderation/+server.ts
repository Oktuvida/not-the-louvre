import type { RequestHandler } from './$types';
import { moderateWish } from '#lib/server/artwork/service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';

const WISH_MODERATION_ERROR = {
	fallbackCode: 'MODERATION_FAILED',
	fallbackMessage: 'Slip moderation failed',
	scope: 'wish moderation'
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { action?: 'dismiss' | 'hide' | 'unhide' };
		await moderateWish(
			{ action: body.action ?? 'hide', wishId: event.params.wishId },
			{ user: event.locals.user }
		);

		return new Response(null, { status: 204 });
	} catch (error) {
		return toApiErrorResponse(error, WISH_MODERATION_ERROR);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		await moderateWish(
			{ action: 'delete', wishId: event.params.wishId },
			{ user: event.locals.user }
		);

		return new Response(null, { status: 204 });
	} catch (error) {
		return toApiErrorResponse(error, WISH_MODERATION_ERROR);
	}
};
