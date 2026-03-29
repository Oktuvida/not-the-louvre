import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { getTextModerationSnapshot } from '$lib/server/moderation/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json(
		{ code: 'PUBLISH_FAILED', message: 'Moderation policy request failed' },
		{ status: 500 }
	);
};

export const GET: RequestHandler = async () => {
	try {
		return json(await getTextModerationSnapshot());
	} catch (error) {
		return toErrorResponse(error);
	}
};
