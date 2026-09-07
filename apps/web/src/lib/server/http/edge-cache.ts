// On Cloudflare the Worker runs in *front* of the CDN cache, so a response it
// returns is never stored just because it carries `cache-control` — that header
// only buys browser caching. Reaching the shared colo cache means using the
// Cache API explicitly, which is what the media, avatar and favicon handlers
// already do. This is that pattern, factored out so JSON endpoints can reuse it
// without each one re-deriving the waitUntil bookkeeping.

type EdgeCachePlatform = Pick<App.Platform, 'caches' | 'context'> | undefined;

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

export const readEdgeCache = async (
	platform: EdgeCachePlatform,
	request: Request
): Promise<Response | undefined> => {
	const cache = platform?.caches?.default;
	if (!cache) return undefined;

	return (await cache.match(request.url)) ?? undefined;
};

export const storeInEdgeCache = (
	platform: EdgeCachePlatform,
	request: Request,
	response: Response
) => {
	const cache = platform?.caches?.default;
	if (!cache) return;

	const stored = cache.put(request.url, response.clone()).catch(() => {});
	platform?.context?.waitUntil(stored);
};
