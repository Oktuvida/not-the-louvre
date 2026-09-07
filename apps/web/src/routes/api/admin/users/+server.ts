import type { RequestHandler } from './$types';
import { toApiErrorResponse } from '$lib/server/http/errors';
import { listUsers } from '$lib/server/user/admin.service';

// Answers errors as `{ code, message }` like every other JSON route; the admin
// dashboard used to need a content-type sniff because this one spoke text.
const USER_LISTING_ERROR = {
	fallbackCode: 'USER_LISTING_FAILED',
	fallbackMessage: 'User listing failed',
	scope: 'admin user listing'
};

export const GET: RequestHandler = async (event) => {
	try {
		const cursor = event.url.searchParams.get('cursor') ?? null;
		const limitParam = event.url.searchParams.get('limit');
		const limit = limitParam ? parseInt(limitParam, 10) : undefined;

		const page = await listUsers({ cursor, limit }, { user: event.locals.user ?? null });

		return Response.json(page);
	} catch (error) {
		return toApiErrorResponse(error, USER_LISTING_ERROR);
	}
};
