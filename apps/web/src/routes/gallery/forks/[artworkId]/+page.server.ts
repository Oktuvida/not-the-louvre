import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	toGalleryArtwork,
	toGalleryArtworkDetail
} from '#lib/features/gallery-exploration/gallery-adapter.js';
import { forksDiscoveryRequest } from '#lib/features/gallery-exploration/model/discovery.js';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { getArtworkDetail, listArtworkDiscovery } from '#lib/server/artwork/read.service.js';

// What came of a drawing: its forks on a wall, under the piece itself. Like a
// visit to an artist's studio it is no room of the gallery, so no tab lights
// up, and it is read in one go.
export const load: PageServerLoad = async ({ locals, params }) => {
	const context = { user: locals.user };
	const original = await getArtworkDetail(params.artworkId, context).catch((cause: unknown) => {
		if (cause instanceof ArtworkFlowError && cause.status === 404) {
			error(404, 'Artwork not found');
		}
		throw cause;
	});

	const request = forksDiscoveryRequest(original.id);
	const discovery = await listArtworkDiscovery({ ...request, cursor: null }, context);

	return {
		artworks: discovery.items.map((item) => toGalleryArtwork(item)),
		discovery: { pageInfo: discovery.pageInfo, request },
		emptyStateMessage: discovery.items.length === 0 ? 'Nobody has forked this piece yet.' : null,
		forksOf: toGalleryArtworkDetail(original),
		meta: {
			description: `Drawings forked from ${original.title} on Not the Louvre.`,
			title: `Forks of ${original.title}`
		} satisfies RouteMeta,
		roomId: null,
		viewer: locals.user ?? null
	};
};
