import {
	PUBLIC_SUPABASE_ANON_KEY,
	SUPABASE_ANON_KEY,
	ANON_KEY,
	PUBLIC_SUPABASE_URL,
	SUPABASE_PUBLIC_URL
} from '$app/env/private';

import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { getIP } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { getArtworkDetail } from '#lib/server/artwork/read.service.js';
import { publishArtwork } from '#lib/server/artwork/service.js';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { toActionFailure } from '#lib/server/http/errors.js';

const toFailure = (errorValue: unknown, fallback: string) =>
	toActionFailure(errorValue, {
		fallbackMessage: fallback,
		scope: 'demo realtime publish action'
	});

export const load: PageServerLoad = async (event) => {
	if (event.locals.integrityFailure) {
		throw error(500, 'Authenticated session is missing its product user profile');
	}

	if (!event.locals.user) {
		throw redirect(302, '/demo/better-auth/login');
	}

	const artworkId = event.url.searchParams.get('artworkId');
	let trackedArtwork = null;
	let trackedArtworkState: 'idle' | 'ready' | 'unavailable' = 'idle';

	if (artworkId) {
		try {
			trackedArtwork = await getArtworkDetail(artworkId, { user: event.locals.user });
			trackedArtworkState = trackedArtwork ? 'ready' : 'unavailable';
		} catch (errorValue) {
			if (
				errorValue instanceof ArtworkFlowError &&
				(errorValue.code === 'NOT_FOUND' || errorValue.status === 404)
			) {
				trackedArtwork = null;
				trackedArtworkState = 'unavailable';
			} else {
				throw errorValue;
			}
		}
	}

	return {
		// The root layout renders the only <title>; the route names itself here.
		meta: { title: 'Artwork Realtime Vote Demo' } satisfies RouteMeta,
		realtimeConfig: {
			anonKey: PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || ANON_KEY || null,
			url: PUBLIC_SUPABASE_URL || SUPABASE_PUBLIC_URL || null
		},
		trackedArtwork,
		trackedArtworkState,
		user: event.locals.user
	};
};

export const actions: Actions = {
	publish: async (event) => {
		const formData = await event.request.formData();
		const media = formData.get('media');

		if (!(media instanceof File)) {
			return fail(400, {
				code: 'INVALID_MEDIA_FORMAT',
				message: 'Artwork media is required'
			});
		}

		try {
			const artwork = await publishArtwork(
				{
					media,
					title: formData.get('title')?.toString() ?? ''
				},
				{
					ipAddress: getIP(event.request, auth.options),
					user: event.locals.user
				}
			);

			throw redirect(
				303,
				`/demo/artwork-realtime-votes?artworkId=${encodeURIComponent(artwork.id)}`
			);
		} catch (errorValue) {
			if (isRedirect(errorValue)) {
				throw errorValue;
			}

			return toFailure(errorValue, 'Unexpected artwork publish error');
		}
	}
};
