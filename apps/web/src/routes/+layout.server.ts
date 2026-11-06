import type { LayoutServerLoad } from './$types';
import { inlineAvatarFavicon, resolveFaviconState } from '#lib/favicon.js';
import { getViewerContentPreferences } from '#lib/server/moderation/service.js';
import { inlineAvatarFavicon as drawInlineAvatarFavicon } from '#lib/server/user/inline-favicon.js';

// The viewer's single preference row is read here once and handed down: the
// home load and the gallery room loader used to re-read the same row for
// `adultContentEnabled` on every server-rendered page.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const [viewerContentPreferences, inlineFavicon] = await Promise.all([
		locals.user
			? getViewerContentPreferences({ user: locals.user })
			: { adultContentEnabled: false, ambientAudioEnabled: null },
		drawInlineAvatarFavicon(locals.user, url.origin)
	]);

	return {
		adultContentEnabled: viewerContentPreferences.adultContentEnabled,
		ambientAudioEnabled: viewerContentPreferences.ambientAudioEnabled,
		favicon: inlineFavicon ? inlineAvatarFavicon(inlineFavicon) : resolveFaviconState(locals.user),
		viewer: locals.user
			? {
					id: locals.user.id,
					isBanned: Boolean(locals.user.isBanned),
					nickname: locals.user.nickname,
					role: locals.user.role
				}
			: null
	};
};
