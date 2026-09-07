import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { edgeCacheControl, readEdgeCache, storeInEdgeCache } from '$lib/server/http/edge-cache';
import { getTextModerationSnapshot } from '$lib/server/moderation/service';

// Three rows that only change when an admin edits a policy, fetched by the
// browser once per session in front of the user's first keystroke. The window
// matches the server-side policy memo so both converge at the same rate.
const EDGE_TTL_SECONDS = 60;
const CACHE_CONTROL = edgeCacheControl(EDGE_TTL_SECONDS, 300);

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json(
		{ code: 'PUBLISH_FAILED', message: 'Moderation policy request failed' },
		{ status: 500 }
	);
};

export const GET: RequestHandler = async (event) => {
	try {
		const cached = await readEdgeCache(event.platform, event.request);
		if (cached) return cached;

		const response = json(await getTextModerationSnapshot(), {
			headers: { 'cache-control': CACHE_CONTROL }
		});

		storeInEdgeCache(event.platform, event.request, response);

		return response;
	} catch (error) {
		return toErrorResponse(error);
	}
};
