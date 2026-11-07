import { getIP } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '#lib/server/auth.js';
import { createWish, listWishes } from '#lib/server/artwork/service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';

const WISH_CREATE_ERROR = {
	fallbackCode: 'WISH_FAILED',
	fallbackMessage: 'The slip did not reach the mailbox',
	scope: 'wish create'
};

const WISH_LIST_ERROR = {
	fallbackCode: 'WISH_LISTING_FAILED',
	fallbackMessage: 'The mailbox would not open',
	scope: 'wish listing'
};

export const GET: RequestHandler = async (event) => {
	try {
		const seen = event.url.searchParams.get('seen')?.split(',').filter(Boolean) ?? [];
		const wishes = await listWishes({ seen }, { user: event.locals.user });
		return Response.json({ wishes });
	} catch (error) {
		return toApiErrorResponse(error, WISH_LIST_ERROR);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { text?: string };
		const wish = await createWish(
			{ text: body.text ?? '' },
			{ ipAddress: getIP(event.request, auth.options), user: event.locals.user }
		);

		return Response.json({ wish }, { status: 201 });
	} catch (error) {
		return toApiErrorResponse(error, WISH_CREATE_ERROR);
	}
};
