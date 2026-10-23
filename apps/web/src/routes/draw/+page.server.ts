import { error, fail, redirect } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { decodeCompressedDrawingDocumentToEditableDocument } from '$lib/server/drawing-document/storage';
import type { RouteMeta } from '$lib/features/shared-ui/site-meta';
import { getArtworkDetail } from '$lib/server/artwork/read.service';
import { publishArtwork } from '$lib/server/artwork/service';
import { toActionFailure } from '$lib/server/http/errors';

const toFailure = (errorValue: unknown, fallback: string) =>
	toActionFailure(errorValue, {
		extra: { action: 'publish' },
		fallbackMessage: fallback,
		scope: 'publish action'
	});

/**
 * Coarse "is this a phone" read for the first paint only. Chromium sends the
 * low-entropy `sec-ch-ua-mobile` hint by default, so no Accept-CH round trip is
 * needed; everything else falls back to a user-agent test. The client's
 * `matchMedia('(max-width: 700px)')` sync stays the authority and corrects a
 * wrong guess on mount — exactly what used to happen on every mobile visit,
 * except now it usually has nothing to correct.
 */
const isMobileRequest = (request: Request) => {
	const mobileHint = request.headers.get('sec-ch-ua-mobile');
	if (mobileHint) {
		return mobileHint.trim() === '?1';
	}

	return /Android|iPhone|iPod|IEMobile|Opera Mini|Mobile Safari/i.test(
		request.headers.get('user-agent') ?? ''
	);
};

export const load: PageServerLoad = async (event) => {
	if (event.locals.integrityFailure) {
		throw error(500, 'Authenticated session is missing its product user profile');
	}

	if (!event.locals.user) {
		throw redirect(302, '/');
	}

	const forkArtworkId = event.url.searchParams.get('fork');
	const forkParent = forkArtworkId
		? await getArtworkDetail(forkArtworkId, {
				user: event.locals.user,
				// The studio is the only reader of the drawing document: every
				// other detail read leaves that column in Postgres.
				withDrawingDocument: true
			}).then(async (artwork) => ({
				drawingDocument: artwork.drawingDocument
					? await decodeCompressedDrawingDocumentToEditableDocument(artwork.drawingDocument)
					: null,
				id: artwork.id,
				isNsfw: artwork.isNsfw,
				mediaUrl: artwork.mediaUrl,
				title: artwork.title
			}))
		: null;

	return {
		forkParent,
		initialIsMobile: isMobileRequest(event.request),
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
		const media = formData.get('media');
		const title = formData.get('title')?.toString() ?? '';
		const parentArtworkId = formData.get('parentArtworkId')?.toString() ?? null;
		const isNsfw = formData.get('isNsfw')?.toString() === 'true';

		if (!drawingDocument && !(media instanceof File)) {
			return fail(400, {
				action: 'publish',
				code: 'INVALID_MEDIA_FORMAT',
				message: 'Artwork media or drawing document is required'
			});
		}

		try {
			const artwork = await publishArtwork(
				{
					drawingDocument,
					isNsfw,
					media: media instanceof File ? media : null,
					parentArtworkId,
					title
				},
				{
					ipAddress: getIp(event.request, auth.options),
					user: event.locals.user
				}
			);

			return {
				action: 'publish',
				artwork: {
					id: artwork.id,
					isNsfw: artwork.isNsfw,
					mediaUrl: `/api/artworks/${artwork.id}/media`,
					title: artwork.title
				},
				success: true
			};
		} catch (errorValue) {
			return toFailure(errorValue, 'Unexpected artwork publish error');
		}
	}
};
