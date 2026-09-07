import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toApiErrorResponse } from '$lib/server/http/errors';
import { updateUserRole } from '$lib/server/user/admin.service';

const ROLE_UPDATE_ERROR = {
	fallbackCode: 'ROLE_UPDATE_FAILED',
	fallbackMessage: 'Role update failed',
	scope: 'admin role update'
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { role?: string };

		if (!body.role) {
			return json({ code: 'INVALID_ROLE', message: 'Missing role field' }, { status: 400 });
		}

		const result = await updateUserRole(
			{ role: body.role, userId: event.params.userId },
			{ user: event.locals.user ?? null }
		);

		return Response.json(result);
	} catch (error) {
		return toApiErrorResponse(error, ROLE_UPDATE_ERROR);
	}
};
