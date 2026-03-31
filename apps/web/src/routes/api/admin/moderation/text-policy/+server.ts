import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	getTextModerationSnapshot,
	updateTextModerationPolicies
} from '$lib/server/moderation/service';

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
		if (event.locals.user?.role !== 'admin') {
			throw new ArtworkFlowError(
				event.locals.user ? 403 : 401,
				event.locals.user ? 'Admin access required' : 'Authentication required',
				event.locals.user ? 'FORBIDDEN' : 'UNAUTHENTICATED'
			);
		}

		return json(await getTextModerationSnapshot());
	} catch (error) {
		return toErrorResponse(error);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as {
			policies?: Partial<
				Record<
					'nickname' | 'comment' | 'artwork_title',
					{ allowlist: string[]; blocklist: string[]; expectedVersion: number }
				>
			>;
		};

		const snapshot = await updateTextModerationPolicies(
			{ policies: body.policies ?? {} },
			{ user: event.locals.user ?? null }
		);

		return json(snapshot);
	} catch (error) {
		return toErrorResponse(error);
	}
};
