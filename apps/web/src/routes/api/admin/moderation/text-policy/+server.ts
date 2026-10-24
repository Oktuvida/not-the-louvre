import type { RequestEvent, RequestHandler } from './$types';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import {
	getTextModerationSnapshot,
	updateTextModerationPolicies
} from '#lib/server/moderation/service.js';
import type { TextModerationContext } from '#lib/shared/moderation/text-policy.js';
import { edgeCache, runAfterResponse } from '#lib/server/platform.js';

// The public snapshot at /api/moderation/text-policy is stored in the colo
// cache, so an admin edit has to drop the local copy or the admin keeps reading
// their own stale policy right after saving it. cache.delete() only reaches the
// local datacenter, which is exactly where the editing admin's next request
// lands; remote colos wait out the short TTL.
const purgeTextPolicyEdgeCache = (event: RequestEvent) => {
	const cache = edgeCache();
	if (!cache) return;

	const purge = cache
		.delete(new URL('/api/moderation/text-policy', event.url.origin).href)
		.catch(() => {});
	runAfterResponse(purge);
};

const POLICY_READ_ERROR = {
	fallbackCode: 'POLICY_READ_FAILED',
	fallbackMessage: 'Moderation policy request failed',
	scope: 'admin moderation policy read'
};

const POLICY_UPDATE_ERROR = {
	fallbackCode: 'POLICY_UPDATE_FAILED',
	fallbackMessage: 'Moderation policy update failed',
	scope: 'admin moderation policy update'
};

export const GET: RequestHandler = async (event) => {
	try {
		if (event.locals.user?.role !== 'admin') {
			throw new ArtworkFlowError(
				event.locals.user ? 403 : 401,
				event.locals.user ? 'Admin access required' : 'Authentication required',
				event.locals.user ? 'FORBIDDEN' : 'UNAUTHENTICATED'
			);
		}

		return Response.json(await getTextModerationSnapshot());
	} catch (error) {
		return toApiErrorResponse(error, POLICY_READ_ERROR);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as {
			// The same context vocabulary the policy table and the filter speak,
			// so a new context does not need a fourth hand-written union.
			policies?: Partial<
				Record<
					TextModerationContext,
					{ allowlist: string[]; blocklist: string[]; expectedVersion: number }
				>
			>;
		};

		const snapshot = await updateTextModerationPolicies(
			{ policies: body.policies ?? {} },
			{ user: event.locals.user ?? null }
		);
		purgeTextPolicyEdgeCache(event);

		return Response.json(snapshot);
	} catch (error) {
		return toApiErrorResponse(error, POLICY_UPDATE_ERROR);
	}
};
