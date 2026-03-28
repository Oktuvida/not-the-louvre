import { env } from '$env/dynamic/private';
import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { getArtworkDetail } from '$lib/server/artwork/read.service';
import { publishArtwork } from '$lib/server/artwork/service';

const toFailure = (errorValue: unknown, fallback: string) => {
	if (
		errorValue instanceof ArtworkFlowError ||
		(typeof errorValue === 'object' &&
			errorValue !== null &&
			'status' in errorValue &&
			'message' in errorValue &&
			'code' in errorValue)
	) {
		const artworkError = errorValue as Pick<ArtworkFlowError, 'status' | 'message' | 'code'>;
		return fail(artworkError.status, {
			code: artworkError.code,
			message: artworkError.message
		});
	}

	if (errorValue instanceof Error) {
		return fail(500, { message: errorValue.message || fallback });
	}

	return fail(500, { message: fallback });
};

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
		realtimeConfig: {
			anonKey: env.PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.ANON_KEY || null,
			url: env.PUBLIC_SUPABASE_URL || env.SUPABASE_PUBLIC_URL || null
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
					ipAddress: getIp(event.request, auth.options),
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
