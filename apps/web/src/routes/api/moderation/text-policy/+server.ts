import type { RequestHandler } from './$types';
import { edgeCacheControl, readEdgeCache, storeInEdgeCache } from '#lib/server/http/edge-cache.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { getTextModerationSnapshot } from '#lib/server/moderation/service.js';

// Three rows that only change when an admin edits a policy, fetched by the
// browser once per session in front of the user's first keystroke. The window
// matches the server-side policy memo so both converge at the same rate.
const EDGE_TTL_SECONDS = 60;
const CACHE_CONTROL = edgeCacheControl(EDGE_TTL_SECONDS, 300);

const POLICY_SNAPSHOT_ERROR = {
	fallbackCode: 'POLICY_READ_FAILED',
	fallbackMessage: 'Moderation policy request failed',
	scope: 'moderation policy snapshot'
};

export const GET: RequestHandler = async (event) => {
	try {
		const cached = await readEdgeCache(event.request);
		if (cached) return cached;

		const response = Response.json(await getTextModerationSnapshot(), {
			headers: { 'cache-control': CACHE_CONTROL }
		});

		storeInEdgeCache(event.request, response);

		return response;
	} catch (error) {
		return toApiErrorResponse(error, POLICY_SNAPSHOT_ERROR);
	}
};
