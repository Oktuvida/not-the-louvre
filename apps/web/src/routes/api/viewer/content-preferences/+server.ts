import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	getViewerContentPreferences,
	setViewerAdultContentEnabled,
	setViewerAmbientAudioEnabled
} from '$lib/server/moderation/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json(
		{ code: 'PUBLISH_FAILED', message: 'Viewer preference request failed' },
		{ status: 500 }
	);
};

export const GET: RequestHandler = async (event) => {
	try {
		return json(await getViewerContentPreferences({ user: event.locals.user ?? null }));
	} catch (error) {
		return toErrorResponse(error);
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as {
			adultContentEnabled?: boolean;
			ambientAudioEnabled?: boolean;
		};

		if (typeof body.ambientAudioEnabled === 'boolean') {
			return json(
				await setViewerAmbientAudioEnabled(
					{ enabled: body.ambientAudioEnabled },
					{ user: event.locals.user ?? null }
				)
			);
		}

		return json(
			await setViewerAdultContentEnabled(
				{ enabled: Boolean(body.adultContentEnabled) },
				{ user: event.locals.user ?? null }
			)
		);
	} catch (error) {
		return toErrorResponse(error);
	}
};
