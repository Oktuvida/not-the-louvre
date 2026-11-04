import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { toGalleryArtwork } from '#lib/features/gallery-exploration/gallery-adapter.js';
import { artistDiscoveryRequest } from '#lib/features/gallery-exploration/model/discovery.js';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { getArtistStudio, listArtworkDiscovery } from '#lib/server/artwork/read.service.js';

// A visit to another artist's studio: their wall, at an address to share. It
// is no room of the gallery, so no tab lights up, and it is read in one go
// rather than streamed: there is no room to slide in, nor one to remember.
export const load: PageServerLoad = async ({ locals, params }) => {
	const context = { user: locals.user };
	const artist = await getArtistStudio(params.nickname.toLowerCase(), context).catch(
		(cause: unknown) => {
			if (cause instanceof ArtworkFlowError && cause.status === 404) {
				error(404, 'Artist not found');
			}
			throw cause;
		}
	);

	if (artist.id === locals.user?.id) redirect(302, '/gallery/your-studio');

	const request = artistDiscoveryRequest(artist.id);
	const discovery = await listArtworkDiscovery({ ...request, cursor: null }, context);

	return {
		artist,
		artworks: discovery.items.map((item) => toGalleryArtwork(item)),
		discovery: { pageInfo: discovery.pageInfo, request },
		emptyStateMessage:
			discovery.items.length === 0 ? `${artist.nickname} has not hung anything yet.` : null,
		meta: {
			description: `Drawings by ${artist.nickname} on Not the Louvre.`,
			title: `The studio of ${artist.nickname}`
		} satisfies RouteMeta,
		roomId: null,
		viewer: locals.user ?? null
	};
};
