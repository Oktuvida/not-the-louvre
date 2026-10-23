import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.js';
import { getArtworkDetail, listArtworkDiscovery } from '#lib/server/artwork/read.service.js';
import { publishArtwork } from '#lib/server/artwork/service.js';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { toActionFailure } from '#lib/server/http/errors.js';

const toFailure = (errorValue: unknown, fallback: string) =>
	toActionFailure(errorValue, {
		fallbackMessage: fallback,
		scope: 'demo artwork publish action'
	});

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
		// The root layout renders the only <title>; the route names itself here.
		meta: { title: 'Artwork Publish Demo' } satisfies RouteMeta,
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
					isNsfw: formData.get('isNsfw')?.toString() === 'true',
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
