import { getIP } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '#lib/server/auth.js';
import { submitContentReport } from '#lib/server/artwork/service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';

const WISH_REPORT_ERROR = {
	fallbackCode: 'REPORT_FAILED',
	fallbackMessage: 'Slip report failed',
	scope: 'wish report'
};

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { details?: string; reason?: string };
		const report = await submitContentReport(
			{
				details: body.details,
				reason: body.reason ?? '',
				wishId: event.params.wishId
			},
			{ ipAddress: getIP(event.request, auth.options), user: event.locals.user }
		);

		return Response.json({ report }, { status: 201 });
	} catch (error) {
		return toApiErrorResponse(error, WISH_REPORT_ERROR);
	}
};
