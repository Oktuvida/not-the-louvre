import type { RequestHandler } from './$types';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { banUser, unbanUser } from '#lib/server/user/admin.service.js';

const BAN_UPDATE_ERROR = {
	fallbackCode: 'BAN_UPDATE_FAILED',
	fallbackMessage: 'Ban update failed',
	scope: 'admin ban update'
};

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

		return Response.json(
			{ code: 'INVALID_BAN_ACTION', message: 'Invalid ban action' },
			{ status: 400 }
		);
	} catch (error) {
		return toApiErrorResponse(error, BAN_UPDATE_ERROR);
	}
};
