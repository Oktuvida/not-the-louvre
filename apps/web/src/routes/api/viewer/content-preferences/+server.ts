import type { RequestHandler } from './$types';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import {
	getViewerContentPreferences,
	setViewerAdultContentEnabled,
	setViewerAmbientAudioEnabled
} from '#lib/server/moderation/service.js';

const PREFERENCE_READ_ERROR = {
	fallbackCode: 'PREFERENCE_READ_FAILED',
	fallbackMessage: 'Viewer preference request failed',
	scope: 'viewer preference read'
};

const PREFERENCE_UPDATE_ERROR = {
	fallbackCode: 'PREFERENCE_UPDATE_FAILED',
	fallbackMessage: 'Viewer preference update failed',
	scope: 'viewer preference update'
};

export const GET: RequestHandler = async (event) => {
	try {
		return Response.json(await getViewerContentPreferences({ user: event.locals.user ?? null }));
	} catch (error) {
		return toApiErrorResponse(error, PREFERENCE_READ_ERROR);
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as {
			adultContentEnabled?: boolean;
			ambientAudioEnabled?: boolean;
		};

		if (typeof body.ambientAudioEnabled === 'boolean') {
			return Response.json(
				await setViewerAmbientAudioEnabled(
					{ enabled: body.ambientAudioEnabled },
					{ user: event.locals.user ?? null }
				)
			);
		}

		return Response.json(
			await setViewerAdultContentEnabled(
				{ enabled: Boolean(body.adultContentEnabled) },
				{ user: event.locals.user ?? null }
			)
		);
	} catch (error) {
		return toApiErrorResponse(error, PREFERENCE_UPDATE_ERROR);
	}
};
