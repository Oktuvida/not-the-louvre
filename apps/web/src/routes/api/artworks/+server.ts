import { json } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';
import { listArtworkDiscovery } from '$lib/server/artwork/read.service';
import { publishArtwork, withoutDrawingDocument } from '$lib/server/artwork/service';
import { edgeCacheControl, readEdgeCache, storeInEdgeCache } from '$lib/server/http/edge-cache';
import { toApiErrorResponse } from '$lib/server/http/errors';

// Anonymous discovery pages are viewer-independent: `viewerVote` collapses to a
// literal null and the visibility filter ignores the moderator flag, so every
// signed-out visitor gets the same bytes. Sharing them at the edge is gated on
// `locals.user` being null rather than on a `Vary` the Workers Cache API would
// not honour anyway, which makes a cross-viewer leak impossible by construction.
// The TTL is short because `caches.default.delete()` is colo-local: an artwork
// hidden by moderation would otherwise stay listed elsewhere for the window.
const ANONYMOUS_EDGE_TTL_SECONDS = 30;
const ANONYMOUS_CACHE_CONTROL = edgeCacheControl(ANONYMOUS_EDGE_TTL_SECONDS, 120);
const SIGNED_IN_CACHE_CONTROL = 'private, no-store';

const PUBLISH_ERROR = {
	fallbackCode: 'PUBLISH_FAILED',
	fallbackMessage: 'Artwork publish failed',
	scope: 'artwork publish'
};

const DISCOVERY_ERROR = {
	fallbackCode: 'DISCOVERY_FAILED',
	fallbackMessage: 'Artwork discovery failed',
	scope: 'artwork discovery'
};

export const POST: RequestHandler = async (event) => {
	const formData = await event.request.formData();
	const media = formData.get('media');

	if (!(media instanceof File)) {
		return json(
			{ code: 'INVALID_MEDIA_FORMAT', message: 'Artwork media must be provided' },
			{ status: 400 }
		);
	}

	try {
		const artwork = await publishArtwork(
			{
				isNsfw: formData.get('isNsfw')?.toString() === 'true',
				media,
				parentArtworkId: formData.get('parentArtworkId')?.toString(),
				title: formData.get('title')?.toString()
			},
			{
				ipAddress: getIp(event.request, auth.options),
				user: event.locals.user
			}
		);

		return json({ artwork: withoutDrawingDocument(artwork) }, { status: 201 });
	} catch (error) {
		return toApiErrorResponse(error, PUBLISH_ERROR);
	}
};

export const GET: RequestHandler = async (event) => {
	const isAnonymous = !event.locals.user;

	if (isAnonymous) {
		const cached = await readEdgeCache(event.platform, event.request);
		if (cached) return cached;
	}

	const authorId = event.url.searchParams.get('authorId');
	const sort = event.url.searchParams.get('sort') ?? 'recent';
	const window = event.url.searchParams.get('window');
	const cursor = event.url.searchParams.get('cursor');
	const limitValue = event.url.searchParams.get('limit');
	const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

	try {
		const discoveryRequest = {
			cursor,
			limit,
			sort: sort as never,
			window,
			...(authorId ? { authorId } : {})
		};

		const discovery = await listArtworkDiscovery(discoveryRequest, { user: event.locals.user });
		const response = json(discovery, {
			headers: {
				'cache-control': isAnonymous ? ANONYMOUS_CACHE_CONTROL : SIGNED_IN_CACHE_CONTROL
			}
		});

		if (isAnonymous) {
			storeInEdgeCache(event.platform, event.request, response);
		}

		return response;
	} catch (error) {
		return toApiErrorResponse(error, DISCOVERY_ERROR);
	}
};
