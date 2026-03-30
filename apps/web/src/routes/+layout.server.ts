import type { LayoutServerLoad } from './$types';
import { resolveFaviconState } from '$lib/favicon';

export const load: LayoutServerLoad = async ({ locals }) => ({
	favicon: resolveFaviconState(locals.user)
});
