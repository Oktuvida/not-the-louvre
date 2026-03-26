import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { artworkReadRepository } from '$lib/server/artwork/read.repository';
import { streamArtworkStorageObject } from '$lib/server/artwork/storage';

export const GET: RequestHandler = async (event) => {
	try {
		const media = await artworkReadRepository.findArtworkMediaById(event.params.artworkId);

		if (!media) {
			throw new ArtworkFlowError(404, 'Artwork not found', 'NOT_FOUND');
		}

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
