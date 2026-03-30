import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { banUser, unbanUser } from '$lib/server/user/admin.service';

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { action?: 'ban' | 'unban'; reason?: string };

		if (body.action === 'ban') {
			return Response.json(
				await banUser(
					{ reason: body.reason ?? '', userId: event.params.userId },
					{ user: event.locals.user ?? null }
				)
			);
		}

		if (body.action === 'unban') {
			return Response.json(
				await unbanUser({ userId: event.params.userId }, { user: event.locals.user ?? null })
			);
		}

		return new Response('Invalid ban action', { status: 400 });
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return new Response(error.message, { status: error.status });
		}

		return new Response('Ban update failed', { status: 500 });
	}
};
