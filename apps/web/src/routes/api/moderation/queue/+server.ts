import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { listModerationQueue } from '$lib/server/artwork/read.service';

export const GET: RequestHandler = async (event) => {
	try {
		const cursor = event.url.searchParams.get('cursor') ?? null;
		const limitParam = event.url.searchParams.get('limit');
		const limit = limitParam ? parseInt(limitParam, 10) : undefined;

		const page = await listModerationQueue({ cursor, limit }, { user: event.locals.user ?? null });

		return Response.json(page);
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return new Response(error.message, { status: error.status });
		}

		return new Response('Moderation queue read failed', { status: 500 });
	}
};
