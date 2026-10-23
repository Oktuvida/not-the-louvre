import type { RequestEvent, RequestHandler } from './$types';
import { etagMatches, notModified } from '#lib/server/http/conditional.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { avatarService } from '#lib/server/user/avatar.service.js';
import { userRepository } from '#lib/server/user/repository.js';
import { streamAvatarStorageObject } from '#lib/server/user/storage.js';
import { resolveUserAvatarPath, resolveUserAvatarUrl } from '#lib/user/avatar-url.js';
import { edgeCache, runAfterResponse } from '#lib/server/platform.js';

// Browser TTL stays at the pre-cache 5 minutes so avatar changes keep
// propagating as fast as before; the edge copy lives longer because uploads
// purge the uploader's own datacenter below (remote colos wait out the TTL).
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';

const AVATAR_READ_ERROR = {
	fallbackCode: 'AVATAR_READ_FAILED',
	fallbackMessage: 'Avatar media read failed',
	scope: 'avatar media read'
};

const AVATAR_UPLOAD_ERROR = {
	fallbackCode: 'AVATAR_UPLOAD_FAILED',
	fallbackMessage: 'Avatar upload failed',
	scope: 'avatar upload'
};

const AVATAR_DELETE_ERROR = {
	fallbackCode: 'AVATAR_DELETE_FAILED',
	fallbackMessage: 'Avatar deletion failed',
	scope: 'avatar delete'
};

// cache.delete only reaches the local datacenter, which is exactly where the
// uploader's next requests land — they see their change immediately.
const purgeAvatarEdgeCache = (event: RequestEvent, userId: string) => {
	const cache = edgeCache();
	if (!cache) return;

	const purge = Promise.all([
		cache.delete(new URL(resolveUserAvatarPath(userId), event.url.origin).href),
		cache.delete(new URL(`/api/users/${userId}/favicon`, event.url.origin).href)
	]).catch(() => {});
	runAfterResponse(purge);
};

export const GET: RequestHandler = async (event) => {
	try {
		const cache = edgeCache();

		const cachedResponse = await cache?.match(event.request.url);
		if (cachedResponse) {
			const cachedEtag = cachedResponse.headers.get('etag');
			if (cachedEtag && etagMatches(event.request, cachedEtag)) {
				return notModified(cachedResponse.headers);
			}

			return cachedResponse;
		}

		// Narrow read: this runs on every avatar image request that misses the
		// edge cache, and the compressed avatar document has no business here.
		const user = await userRepository.findUserAvatarRefById(event.params.userId);

		if (!user || !user.avatarUrl || user.avatarIsHidden) {
			return Response.json({ code: 'NOT_FOUND', message: 'Avatar not found' }, { status: 404 });
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

		if (cache) {
			const cachePut = cache.put(event.request.url, response.clone()).catch(() => {});
			runAfterResponse(cachePut);
		}

		return response;
	} catch (error) {
		return toApiErrorResponse(error, AVATAR_READ_ERROR);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const formData = await event.request.formData();
		const drawingDocument = formData.get('drawingDocument')?.toString() ?? '';

		if (!drawingDocument.trim()) {
			return Response.json(
				{ code: 'INVALID_MEDIA_FORMAT', message: 'Avatar drawing document must be provided' },
				{ status: 400 }
			);
		}

		const updated = await avatarService.uploadAvatar(event.locals.user ?? null, drawingDocument);
		purgeAvatarEdgeCache(event, updated.id);

		return Response.json({
			avatarUrl: resolveUserAvatarUrl(updated.id, updated.avatarUrl, updated.updatedAt.getTime())
		});
	} catch (error) {
		return toApiErrorResponse(error, AVATAR_UPLOAD_ERROR);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const updated = await avatarService.deleteAvatar(event.locals.user ?? null);
		purgeAvatarEdgeCache(event, updated.id);

		return Response.json({ avatarUrl: updated.avatarUrl });
	} catch (error) {
		return toApiErrorResponse(error, AVATAR_DELETE_ERROR);
	}
};
