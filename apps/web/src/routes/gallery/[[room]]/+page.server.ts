import type { PageServerLoad } from './$types';
import { runWithRequestDbConnection } from '#lib/server/db/index.js';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { loadGalleryRoomContent, loadGalleryRoomShell } from '../gallery-data.server';
import { hyperdriveConnectionString } from '#lib/server/platform.js';

// One route node serves both the gallery entry point (`/gallery`) and every
// addressed room (`/gallery/hot-wall`): the optional parameter falls back to
// the hall of fame, which is exactly what the bare URL loaded from its own
// duplicate node before.
//
// Navigating between rooms, the shell returns synchronously so the move lands
// instantly, and the room content is a nested promise SvelteKit streams once
// the queries resolve. That streamed work outlives the request's own DB
// connection (hooks close it when the response headers go out), so it runs on
// a connection of its own. `parent()` is awaited inside that promise, never in
// front of the shell: the layout already read the viewer's content
// preferences for this request.
//
// A first visit (a shared link, a reload) renders the first page on the
// server instead: the HTML then carries the artworks, so the browser fetches
// the first images while the page's JavaScript is still on its way.
export const load: PageServerLoad = async ({ isDataRequest, locals, params, parent }) => {
	const shell = loadGalleryRoomShell(params.room ?? 'hall-of-fame', locals.user);

	// The root layout owns the only <title> in the document; a route says who it
	// is by contributing `meta` here. The bare `/gallery` URL is the shareable
	// entry point to the whole gallery, so it is named for the gallery rather
	// than for the one room it happens to open on; an addressed room carries its
	// own name and description (four rooms used to share one tab title and one
	// share card).
	const meta = (
		params.room
			? { description: shell.room.description, title: shell.room.name }
			: { title: 'Gallery' }
	) satisfies RouteMeta;

	if (!isDataRequest) {
		return {
			...shell,
			initialRoomContent: await loadGalleryRoomContent(shell.roomId, locals.user, {
				adultContentEnabled: (await parent()).adultContentEnabled
			}),
			lazy: { roomContent: null },
			meta
		};
	}

	return {
		...shell,
		initialRoomContent: null,
		meta,
		lazy: {
			roomContent: runWithRequestDbConnection(
				async () =>
					loadGalleryRoomContent(shell.roomId, locals.user, {
						adultContentEnabled: (await parent()).adultContentEnabled
					}),
				{
					connectionString: hyperdriveConnectionString()
				}
			)
		}
	};
};
