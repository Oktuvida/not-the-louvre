import { json } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';
import { submitContentReport } from '$lib/server/artwork/service';
import { toApiErrorResponse } from '$lib/server/http/errors';

const REPORT_ERROR = {
	fallbackCode: 'REPORT_FAILED',
	fallbackMessage: 'Artwork report failed',
	scope: 'artwork report'
};

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as { details?: string; reason?: string };
		const report = await submitContentReport(
			{
				artworkId: event.params.artworkId,
				details: body.details,
				reason: body.reason ?? ''
			},
			{ ipAddress: getIp(event.request, auth.options), user: event.locals.user }
		);

		return json({ report }, { status: 201 });
	} catch (error) {
		return toApiErrorResponse(error, REPORT_ERROR);
	}
};
