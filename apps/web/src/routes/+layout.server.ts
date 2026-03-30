import type { LayoutServerLoad } from './$types';
import { resolveFaviconState } from '$lib/favicon';

export const load: LayoutServerLoad = async ({ locals }) => ({
	favicon: resolveFaviconState(locals.user),
	viewer: locals.user
		? {
				id: locals.user.id,
				isBanned: Boolean(locals.user.isBanned),
				nickname: locals.user.nickname,
				role: locals.user.role
			}
		: null
});
