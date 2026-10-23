import {
	PUBLIC_SUPABASE_ANON_KEY,
	SUPABASE_ANON_KEY,
	ANON_KEY,
	PUBLIC_SUPABASE_URL,
	SUPABASE_PUBLIC_URL
} from '$app/env/private';

import { error, isRedirect, redirect } from '@sveltejs/kit';
import { getIP } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { getArtworkDetail } from '#lib/server/artwork/read.service.js';
import { publishArtwork } from '#lib/server/artwork/service.js';
import { createEmptyDrawingDocument } from '#lib/features/stroke-json/document.js';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { toActionFailure } from '#lib/server/http/errors.js';

// The demo only needs an artwork to vote on, and one stroke makes one.
const DEMO_DRAWING_DOCUMENT = JSON.stringify({
	...createEmptyDrawingDocument('artwork'),
	strokes: [
		{
			color: '#2d2420',
			points: [
				[120, 120],
				[640, 640]
			],
			size: 12
		}
	]
});

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

		try {
			const artwork = await publishArtwork(
				{
					drawingDocument: DEMO_DRAWING_DOCUMENT,
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
