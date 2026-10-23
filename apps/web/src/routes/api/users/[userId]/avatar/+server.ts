import type { RequestEvent, RequestHandler } from './$types';
import { etagMatches, notModified } from '#lib/server/http/conditional.js';
import { toApiErrorResponse } from '#lib/server/http/errors.js';
import { avatarService } from '#lib/server/user/avatar.service.js';
import { userRepository } from '#lib/server/user/repository.js';
import { streamAvatarStorageObject } from '#lib/server/user/storage.js';
import {
	avatarVersionFromStorageKey,
	resolveUserAvatarPath,
	resolveUserAvatarUrl
} from '#lib/user/avatar-url.js';
import { edgeCache, runAfterResponse } from '#lib/server/platform.js';

// The URLs the app hands out name the avatar's version, and a version never
// changes its bytes, so browsers may keep it forever. The edge copy stays
// short-lived: cache.delete only reaches the local datacenter, so hiding an
// avatar can only wait out this TTL elsewhere.
const VERSIONED_CACHE_CONTROL = 'public, max-age=31536000, immutable, s-maxage=3600';

// An address without the current version (the bare path, an old version, a
// legacy avatar) gets whatever the avatar is now, so browsers recheck it within
// minutes; the edge copy lasts longer because uploads purge the uploader's own
// datacenter below.
const UNVERSIONED_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';

// Avatars saved before lossless WebP are still AVIF under their legacy key.
const contentTypeForStorageKey = (storageKey: string) =>
	storageKey.endsWith('.webp') ? 'image/webp' : 'image/avif';

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

		const version = avatarVersionFromStorageKey(user.avatarUrl);
		const isCurrentVersion =
			version !== null && new URL(event.request.url).searchParams.get('v') === version;

		const headers = new Headers();
		headers.set('content-type', contentTypeForStorageKey(user.avatarUrl));
		headers.set(
			'cache-control',
			isCurrentVersion ? VERSIONED_CACHE_CONTROL : UNVERSIONED_CACHE_CONTROL
		);
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
			avatarUrl: resolveUserAvatarUrl(updated.id, updated.avatarUrl)
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
