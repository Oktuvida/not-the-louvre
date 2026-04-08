import { error, fail, redirect } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { decodeCompressedDrawingDocumentToEditableDocument } from '$lib/features/stroke-json/runtime.server';
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
			action: 'publish',
			code: artworkError.code,
			message: artworkError.message
		});
	}

	if (errorValue instanceof Error) {
		return fail(500, { action: 'publish', message: errorValue.message || fallback });
	}

	return fail(500, { action: 'publish', message: fallback });
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
		? await getArtworkDetail(forkArtworkId, { user: event.locals.user }).then(async (artwork) => ({
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
