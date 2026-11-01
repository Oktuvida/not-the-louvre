import { error, fail, redirect } from '@sveltejs/kit';
import { getIP } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.js';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { getArtworkDetail } from '#lib/server/artwork/read.service.js';
import { publishArtwork } from '#lib/server/artwork/service.js';
import { toActionFailure } from '#lib/server/http/errors.js';
import { resolveArtworkMediaUrl } from '#lib/shared/artwork/media-url.js';

const toFailure = (errorValue: unknown, fallback: string) =>
	toActionFailure(errorValue, {
		extra: { action: 'publish' },
		fallbackMessage: fallback,
		scope: 'publish action'
	});

export const load: PageServerLoad = async (event) => {
	if (event.locals.integrityFailure) {
		throw error(500, 'Authenticated session is missing its product user profile');
	}

	if (!event.locals.user) {
		throw redirect(302, '/');
	}

	const forkArtworkId = event.url.searchParams.get('fork');
	// A fork is drawn over the image of its parent, so the studio needs the
	// image, not the parent's drawing (hundreds of KiB on a phone).
	const forkParent = forkArtworkId
		? await getArtworkDetail(forkArtworkId, { user: event.locals.user }).then((artwork) => ({
				drawingDocument: null,
				id: artwork.id,
				isNsfw: artwork.isNsfw,
				mediaUrl: artwork.mediaUrl,
				title: artwork.title
			}))
		: null;

	return {
		forkParent,
		// The root layout renders the only <title> in the document from
		// `page.data.meta`; a page-level <svelte:head><title> would lose to it.
		meta: { title: 'Studio' } satisfies RouteMeta,
		user: event.locals.user
	};
};

export const actions: Actions = {
	publish: async (event) => {
		const formData = await event.request.formData();
		const drawingDocument = formData.get('drawingDocument')?.toString() ?? '';
		const title = formData.get('title')?.toString() ?? '';
		const parentArtworkId = formData.get('parentArtworkId')?.toString() ?? null;
		const isNsfw = formData.get('isNsfw')?.toString() === 'true';

		if (!drawingDocument) {
			return fail(400, {
				action: 'publish',
				code: 'INVALID_MEDIA_FORMAT',
				message: 'Artwork drawing document is required'
			});
		}

		try {
			const artwork = await publishArtwork(
				{
					drawingDocument,
					isNsfw,
					parentArtworkId,
					title
				},
				{
					ipAddress: getIP(event.request, auth.options),
					user: event.locals.user
				}
			);

			return {
				action: 'publish',
				artwork: {
					id: artwork.id,
					isNsfw: artwork.isNsfw,
					mediaUrl: resolveArtworkMediaUrl(artwork.id, artwork.mediaContentType),
					title: artwork.title
				},
				success: true
			};
		} catch (errorValue) {
			return toFailure(errorValue, 'Unexpected artwork publish error');
		}
	}
};
