import type { RequestHandler } from './$types';
import { getArtworkMedia } from '#lib/server/artwork/read.service.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { connectToArtworkTopic } from '#lib/server/realtime/artwork-topics.js';

const LIVE_ERROR = {
	fallbackCode: 'LIVE_UPDATES_FAILED',
	fallbackMessage: 'Live updates are unavailable',
	scope: 'artwork live updates'
};

// A WebSocket that tells the open artwork detail when its votes or comments
// change. The visibility check is the media endpoint's: a viewer can listen to
// exactly the artworks they can see.
export const GET: RequestHandler = async (event) => {
	if (event.request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
		return new Response('Expected a WebSocket upgrade', { status: 426 });
	}

	try {
		await getArtworkMedia(event.params.artworkId, { user: event.locals.user });

		const upstream = await connectToArtworkTopic(event.params.artworkId, event.request);
		if (!upstream?.webSocket) {
			return new Response('Live updates are unavailable', { status: 503 });
		}

		// The topic's response comes back with immutable headers, and SvelteKit
		// adds cookies to whatever a handler returns, so it is rebuilt around the
		// same socket.
		const upgrade: ResponseInit & { webSocket: unknown } = {
			status: 101,
			webSocket: upstream.webSocket
		};
		return new Response(null, upgrade);
	} catch (error) {
		return toApiErrorResponse(error, LIVE_ERROR);
	}
};
