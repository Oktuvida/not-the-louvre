import { edgeCache, runAfterResponse } from '#lib/server/platform.js';
import { galleryRoomIds } from '#lib/shared/gallery/rooms.js';

// On Cloudflare the Worker runs in *front* of the CDN cache, so a response it
// returns is never stored just because it carries `cache-control` — that header
// only buys browser caching. Reaching the shared colo cache means using the
// Cache API explicitly, which is what the media, avatar and favicon handlers
// already do. This is that pattern, factored out so JSON endpoints can reuse it
// without each one re-deriving the waitUntil bookkeeping.

/**
 * Builds a cache-control value for a response the edge is allowed to share.
 * `max-age=0` keeps browsers revalidating while the colo copy stays usable for
 * `ttlSeconds`; the stored entry expires on its own, which matters because
 * `caches.default.delete()` only reaches the local datacenter.
 */
export const edgeCacheControl = (ttlSeconds: number, staleWhileRevalidateSeconds?: number) =>
	[
		'public',
		'max-age=0',
		`s-maxage=${ttlSeconds}`,
		...(staleWhileRevalidateSeconds
			? [`stale-while-revalidate=${staleWhileRevalidateSeconds}`]
			: [])
	].join(', ');

/**
 * What a copy shared among signed-out visitors is stored with. Short, because
 * outside the datacenter that drops it, this is all that retires a stale copy.
 */
export const ANONYMOUS_CACHE_CONTROL = edgeCacheControl(30, 120);

export const readEdgeCache = async (request: Request): Promise<Response | undefined> => {
	const cache = edgeCache();
	if (!cache) return undefined;

	return (await cache.match(request.url)) ?? undefined;
};

/**
 * Every anonymous key that shows an artwork and can be named: its own, and the
 * shared pages it may hang on. The rest of the discovery feed is deliberately
 * absent: its query fan-out is unbounded, so nothing can enumerate its keys and
 * its `s-maxage` is the only bound it has.
 */
export const artworkDetailEdgeCacheKeys = (origin: string | URL, artworkId: string): string[] => [
	new URL(`/api/artworks/${artworkId}`, origin).href,
	artworkPageEdgeCacheKey(origin, artworkId),
	...sharedPageEdgeCacheKeys(origin)
];

// The pages shared among signed-out visitors are stored under addresses no route
// answers: only the Cache API reads them.
export const roomFirstPageEdgeCacheKey = (origin: string | URL, roomId: string) =>
	new URL(`/__edge/rooms/${roomId}/first-page`, origin).href;

export const homeBestPiecesEdgeCacheKey = (origin: string | URL) =>
	new URL('/__edge/home/best-pieces', origin).href;

export const artworkPageEdgeCacheKey = (origin: string | URL, artworkId: string) =>
	new URL(`/__edge/artworks/${artworkId}/page`, origin).href;

/** Every shared page that lists artworks, whichever ones they turn out to be. */
export const sharedPageEdgeCacheKeys = (origin: string | URL): string[] => [
	homeBestPiecesEdgeCacheKey(origin),
	...galleryRoomIds.map((roomId) => roomFirstPageEdgeCacheKey(origin, roomId))
];

/**
 * Drops keys the origin has just invalidated. `caches.default.delete()` only
 * reaches the local datacenter, so this is not a global purge: it is what makes
 * the change visible where the moderator is, and the `s-maxage` above is what
 * bounds it everywhere else.
 */
export const purgeFromEdgeCache = (urls: string[]) => {
	const cache = edgeCache();
	if (!cache) return;

	runAfterResponse(Promise.all(urls.map((url) => cache.delete(url))).catch(() => {}));
};

export const storeInEdgeCache = (request: Request, response: Response) => {
	const cache = edgeCache();
	if (!cache) return;

	runAfterResponse(cache.put(request.url, response.clone()).catch(() => {}));
};

/**
 * What every signed-out visitor is shown: read once, then shared until it runs
 * out. A read that throws, a 404 among them, stores nothing. The copy is JSON,
 * so its dates come back as text.
 */
export const sharedAtTheEdge = async <T>(url: string, read: () => Promise<T>): Promise<T> => {
	const key = new Request(url);
	const shared = await readEdgeCache(key);
	if (shared) return (await shared.json()) as T;

	const value = await read();
	storeInEdgeCache(
		key,
		Response.json(value, { headers: { 'cache-control': ANONYMOUS_CACHE_CONTROL } })
	);
	return value;
};
