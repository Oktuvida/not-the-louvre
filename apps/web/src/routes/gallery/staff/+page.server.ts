import type { PageServerLoad } from './$types';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';

// Who keeps the museum. No room of the gallery, so no tab lights up.
export const load: PageServerLoad = ({ locals }) => ({
	meta: {
		description: 'The people who keep Not the Louvre.',
		title: 'Museum staff'
	} satisfies RouteMeta,
	roomId: null,
	viewer: locals.user ?? null
});
