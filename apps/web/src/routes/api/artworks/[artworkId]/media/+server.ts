import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { getArtworkMedia } from '$lib/server/artwork/read.service';
import { streamArtworkStorageObject } from '$lib/server/artwork/storage';

export const GET: RequestHandler = async (event) => {
	try {
		const media = await getArtworkMedia(event.params.artworkId, { user: event.locals.user });

		const upstream = await streamArtworkStorageObject(media.storageKey);
		const headers = new Headers();
		headers.set('content-type', media.mediaContentType);
		headers.set('cache-control', 'public, max-age=31536000, immutable');

		return new Response(upstream.body, {
			headers,
			status: 200
		});
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return new Response(error.message, { status: error.status });
		}

		return new Response('Artwork media read failed', { status: 500 });
	}
};
