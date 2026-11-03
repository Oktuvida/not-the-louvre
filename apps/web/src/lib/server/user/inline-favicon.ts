import { renderAvatarFavicon } from '#lib/server/render/client.js';
import { edgeCache, runAfterResponse } from '#lib/server/platform.js';
import { streamAvatarStorageObject } from '#lib/server/user/storage.js';
import type { CanonicalUser } from '#lib/server/auth/types.js';

/*
 * A signed-in artist's avatar, written into the page as the tab's icon.
 *
 * Safari shows an icon written into the page straight away, but fetches an
 * icon at an address only when it gets round to it, keeps whatever it last
 * had for the site meanwhile, and never fetches one in a private window: the
 * avatar at /api/users/…/favicon hardly ever reached the tab. So the page
 * carries it as a data URI, drawn at the size a tab shows. It is drawn once
 * per avatar and kept in the colo's cache, keyed by the avatar's version;
 * where there is no cache (the Node dev server) the page keeps the link.
 */

/** The side a tab draws its icon at on a 2x screen. */
export const INLINE_FAVICON_SIZE = 32;
/** How long a kept icon lasts; a new avatar has a new key anyway. */
const KEEP_FOR_SECONDS = 7 * 24 * 60 * 60;

type FaviconArtist = Pick<
	CanonicalUser,
	'avatarOnboardingCompletedAt' | 'avatarUrl' | 'id' | 'updatedAt'
>;

type InlineFaviconDependencies = {
	cache: () => Pick<Cache, 'match' | 'put'> | undefined;
	/** Keeps the cache write going after the response is sent. */
	keep: (promise: Promise<unknown>) => unknown;
	readAvatar: (avatarUrl: string) => Promise<Uint8Array>;
	renderFavicon: (avatar: Uint8Array, size: number) => Promise<Uint8Array>;
};

const toDataUri = (png: Uint8Array) => {
	let binary = '';
	for (const byte of png) binary += String.fromCharCode(byte);
	return `data:image/png;base64,${btoa(binary)}`;
};

export const createInlineAvatarFavicon =
	({ cache, keep, readAvatar, renderFavicon }: InlineFaviconDependencies) =>
	/** The icon as a data URI, or null to leave the tab to the link. */
	async (artist: FaviconArtist | null | undefined, origin: string): Promise<string | null> => {
		if (!artist?.avatarUrl || !artist.avatarOnboardingCompletedAt) return null;
		const store = cache();
		if (!store) return null;

		const key = `${origin}/api/users/${artist.id}/favicon-inline?v=${artist.updatedAt.getTime()}`;
		try {
			const kept = await store.match(key);
			if (kept) return await kept.text();

			const png = await renderFavicon(await readAvatar(artist.avatarUrl), INLINE_FAVICON_SIZE);
			const dataUri = toDataUri(png);
			keep(
				store
					.put(
						key,
						new Response(dataUri, {
							headers: {
								'cache-control': `public, max-age=${KEEP_FOR_SECONDS}`,
								'content-type': 'text/plain'
							}
						})
					)
					.catch(() => {})
			);
			return dataUri;
		} catch {
			return null;
		}
	};

export const inlineAvatarFavicon = createInlineAvatarFavicon({
	cache: edgeCache,
	keep: runAfterResponse,
	readAvatar: async (avatarUrl) =>
		new Uint8Array(await (await streamAvatarStorageObject(avatarUrl)).arrayBuffer()),
	renderFavicon: renderAvatarFavicon
});
