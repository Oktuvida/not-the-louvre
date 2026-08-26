import { json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { etagMatches, notModified } from '$lib/server/http/conditional';
import { avatarService } from '$lib/server/user/avatar.service';
import { userRepository } from '$lib/server/user/repository';
import { streamAvatarStorageObject } from '$lib/server/user/storage';
import { resolveUserAvatarPath, resolveUserAvatarUrl } from '$lib/user/avatar-url';

// Browser TTL stays at the pre-cache 5 minutes so avatar changes keep
// propagating as fast as before; the edge copy lives longer because uploads
// purge the uploader's own datacenter below (remote colos wait out the TTL).
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';

const toErrorResponse = (error: unknown, fallback: { code: string; message: string }) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json(fallback, { status: 500 });
};

// cache.delete only reaches the local datacenter, which is exactly where the
// uploader's next requests land — they see their change immediately.
const purgeAvatarEdgeCache = (event: RequestEvent, userId: string) => {
	const edgeCache = event.platform?.caches?.default;
	if (!edgeCache) return;

	const purge = Promise.all([
		edgeCache.delete(new URL(resolveUserAvatarPath(userId), event.url.origin).href),
		edgeCache.delete(new URL(`/api/users/${userId}/favicon`, event.url.origin).href)
	]).catch(() => {});
	event.platform?.context?.waitUntil(purge);
};

export const GET: RequestHandler = async (event) => {
	try {
		const edgeCache = event.platform?.caches?.default;

		const cachedResponse = await edgeCache?.match(event.request.url);
		if (cachedResponse) {
			const cachedEtag = cachedResponse.headers.get('etag');
			if (cachedEtag && etagMatches(event.request, cachedEtag)) {
				return notModified(cachedResponse.headers);
			}

			return cachedResponse;
		}

		const user = await userRepository.findUserById(event.params.userId);

		if (!user || !user.avatarUrl || user.avatarIsHidden) {
			return json({ code: 'NOT_FOUND', message: 'Avatar not found' }, { status: 404 });
		}

		const etag = `"${user.avatarUrl}:${user.updatedAt.getTime()}"`;

		const headers = new Headers();
		headers.set('content-type', 'image/avif');
		headers.set('cache-control', CACHE_CONTROL);
		headers.set('etag', etag);

		if (etagMatches(event.request, etag)) {
			return notModified(headers);
		}

		const upstream = await streamAvatarStorageObject(user.avatarUrl);
		const contentLength = upstream.headers.get('content-length');
		if (contentLength && !upstream.headers.get('content-encoding')) {
			headers.set('content-length', contentLength);
		}

		const response = new Response(upstream.body, { headers, status: 200 });

		if (edgeCache) {
			const cachePut = edgeCache.put(event.request.url, response.clone()).catch(() => {});
			event.platform?.context?.waitUntil(cachePut);
		}

		return response;
	} catch (error) {
		return toErrorResponse(error, {
			code: 'AVATAR_READ_FAILED',
			message: 'Avatar media read failed'
		});
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const formData = await event.request.formData();
		const drawingDocument = formData.get('drawingDocument')?.toString() ?? '';

		if (!drawingDocument.trim()) {
			return json(
				{ code: 'INVALID_MEDIA_FORMAT', message: 'Avatar drawing document must be provided' },
				{ status: 400 }
			);
		}

		const updated = await avatarService.uploadAvatar(event.locals.user ?? null, drawingDocument);
		purgeAvatarEdgeCache(event, updated.id);

		return json({
			avatarUrl: resolveUserAvatarUrl(updated.id, updated.avatarUrl, updated.updatedAt.getTime())
		});
	} catch (error) {
		return toErrorResponse(error, {
			code: 'PUBLISH_FAILED',
			message: 'Avatar upload failed'
		});
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const updated = await avatarService.deleteAvatar(event.locals.user ?? null);
		purgeAvatarEdgeCache(event, updated.id);

		return json({ avatarUrl: updated.avatarUrl });
	} catch (error) {
		return toErrorResponse(error, {
			code: 'PUBLISH_FAILED',
			message: 'Avatar deletion failed'
		});
	}
};
