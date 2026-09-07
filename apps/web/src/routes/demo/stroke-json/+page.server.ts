import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { RouteMeta } from '$lib/features/shared-ui/site-meta';

export const load: PageServerLoad = async () => {
	if (!dev && env.PLAYWRIGHT !== '1') {
		throw error(404, 'Not found');
	}

	// The root layout renders the only <title>; the lab used to declare its own
	// inside `StrokeJsonLab.svelte`, which raced the layout's on the client.
	return { meta: { title: 'Stroke JSON Lab' } satisfies RouteMeta };
};
