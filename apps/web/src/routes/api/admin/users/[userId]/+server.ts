import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { updateUserRole } from '$lib/server/user/admin.service';

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { role?: string };

		if (!body.role) {
			return new Response('Missing role field', { status: 400 });
		}

		const result = await updateUserRole(
			{ role: body.role, userId: event.params.userId },
			{ user: event.locals.user ?? null }
		);

		return Response.json(result);
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return new Response(error.message, { status: error.status });
		}

		return new Response('Role update failed', { status: 500 });
	}
};
