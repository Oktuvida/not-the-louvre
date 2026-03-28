import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { getArtworkDetail, listArtworkDiscovery } from '$lib/server/artwork/read.service';
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

	const publishedArtworkId = event.url.searchParams.get('published');
	const [feed, publishedArtwork] = await Promise.all([
		listArtworkDiscovery(
			{ cursor: null, limit: 10, sort: 'recent', window: null },
			{
				user: event.locals.user
			}
		),
		publishedArtworkId ? getArtworkDetail(publishedArtworkId, { user: event.locals.user }) : null
	]);

	return {
		feed,
		publishedArtwork,
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

			throw redirect(303, `/demo/artwork-publish?published=${encodeURIComponent(artwork.id)}`);
		} catch (errorValue) {
			if (isRedirect(errorValue)) {
				throw errorValue;
			}

			return toFailure(errorValue, 'Unexpected artwork publish error');
		}
	}
};
