import type { RequestHandler } from './$types';
import { createRealtimeAuthToken } from '#lib/server/realtime/auth.js';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return Response.json(
			{
				code: 'UNAUTHENTICATED',
				message: 'Authentication required'
			},
			{
				headers: { 'cache-control': 'no-store' },
				status: 401
			}
		);
	}

	const realtimeAuth = await createRealtimeAuthToken(event.locals.user);

	return Response.json(realtimeAuth, {
		headers: { 'cache-control': 'no-store' }
	});
};
