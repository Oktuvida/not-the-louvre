import type { LayoutServerLoad } from './$types';
import { resolveFaviconState } from '$lib/favicon';
import { getViewerContentPreferences } from '$lib/server/moderation/service';

export const load: LayoutServerLoad = async ({ locals }) => {
	const viewerContentPreferences = locals.user
		? await getViewerContentPreferences({ user: locals.user })
		: { ambientAudioEnabled: null };

	return {
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
