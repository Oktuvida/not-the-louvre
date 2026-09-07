import type { RequestHandler } from './$types';
import { listModerationQueue } from '$lib/server/artwork/read.service';
import { toApiErrorResponse } from '$lib/server/http/errors';

const MODERATION_QUEUE_ERROR = {
	fallbackCode: 'MODERATION_QUEUE_FAILED',
	fallbackMessage: 'Moderation queue read failed',
	scope: 'moderation queue read'
};

export const GET: RequestHandler = async (event) => {
	try {
		const cursor = event.url.searchParams.get('cursor') ?? null;
		const limitParam = event.url.searchParams.get('limit');
		const limit = limitParam ? parseInt(limitParam, 10) : undefined;

		const page = await listModerationQueue({ cursor, limit }, { user: event.locals.user ?? null });

		return Response.json(page);
	} catch (error) {
		return toApiErrorResponse(error, MODERATION_QUEUE_ERROR);
	}
};
