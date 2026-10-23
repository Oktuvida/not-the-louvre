import type { PageLoad } from './$types';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';

// The demo index has no data of its own; it exists so the route can name
// itself the way every other route does. The root layout renders the only
// <title> in the document from `page.data.meta`, so a page-level <title> here
// would be a second one racing it on the client.
export const load: PageLoad = () => ({
	meta: { title: 'Backend Journey Demos' } satisfies RouteMeta
});
