import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRealtimeAuthToken } from '$lib/server/realtime/auth';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json(
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

	return json(realtimeAuth, {
		headers: { 'cache-control': 'no-store' }
	});
};
