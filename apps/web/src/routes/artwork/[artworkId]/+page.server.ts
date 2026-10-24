import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ARTWORK_DRAWING_DIMENSIONS } from '#lib/features/stroke-json/document.js';
import {
	toGalleryArtworkDetail,
	toGalleryComments
} from '#lib/features/gallery-exploration/gallery-adapter.js';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import {
	getArtworkDetail,
	listArtworkCommentsForViewer
} from '#lib/server/artwork/read.service.js';

// An artwork's own address: the link a visitor copies from the gallery, and
// the one a chat app unfurls into a card showing the drawing itself. A
// sensitive artwork keeps the site card, so a link preview never shows what
// the gallery hides behind its 18+ notice.
export const load: PageServerLoad = async ({ locals, params }) => {
	const context = { user: locals.user };
	const [detail, comments] = await Promise.all([
		getArtworkDetail(params.artworkId, context).catch((cause: unknown) => {
			if (cause instanceof ArtworkFlowError && cause.status === 404) {
				error(404, 'Artwork not found');
			}
			throw cause;
		}),
		listArtworkCommentsForViewer(params.artworkId, context)
	]);
	const artwork = { ...toGalleryArtworkDetail(detail), comments: toGalleryComments(comments) };

	return {
		artwork,
		meta: {
			description: `A drawing by ${artwork.artist} on Not the Louvre.`,
			image: artwork.isNsfw
				? undefined
				: {
						alt: artwork.title,
						height: ARTWORK_DRAWING_DIMENSIONS.height,
						path: artwork.imageUrl,
						width: ARTWORK_DRAWING_DIMENSIONS.width
					},
			title: artwork.title
		} satisfies RouteMeta
	};
};
