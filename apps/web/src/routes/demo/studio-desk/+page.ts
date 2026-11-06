import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';

// The 3D room is drawn in the browser only, and this page is a tool for
// scripts/render-studio-desk.ts: the dev server serves it, a deployed Worker
// does not.
export const ssr = false;

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) throw error(404, 'Not found');
	return { meta: { title: 'Studio desk' } satisfies RouteMeta };
};
