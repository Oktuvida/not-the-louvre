import type { LayoutServerLoad } from './$types';
import { resolveFaviconState } from '#lib/favicon.js';
import { getViewerContentPreferences } from '#lib/server/moderation/service.js';

// The viewer's single preference row is read here once and handed down: the
// home load and the gallery room loader used to re-read the same row for
// `adultContentEnabled` on every server-rendered page.
export const load: LayoutServerLoad = async ({ locals }) => {
	const viewerContentPreferences = locals.user
		? await getViewerContentPreferences({ user: locals.user })
		: { adultContentEnabled: false, ambientAudioEnabled: null };

	return {
		adultContentEnabled: viewerContentPreferences.adultContentEnabled,
		ambientAudioEnabled: viewerContentPreferences.ambientAudioEnabled,
		favicon: resolveFaviconState(locals.user),
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
