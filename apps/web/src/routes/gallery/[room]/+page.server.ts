import type { PageServerLoad } from './$types';
import { runWithRequestDbConnection } from '$lib/server/db';
import { loadGalleryRoomContent, loadGalleryRoomShell } from '../gallery-data.server';

// The shell returns synchronously so navigation lands instantly; the room
// content is a nested promise SvelteKit streams once the queries resolve.
// The streamed work outlives the request's own DB connection (hooks close it
// when the response headers go out), so it runs on a connection of its own.
// `parent()` is awaited inside that promise, never in front of the shell: the
// layout already read the viewer's content preferences for this request.
export const load: PageServerLoad = async ({ locals, params, parent, platform }) => {
	const shell = loadGalleryRoomShell(params.room, locals.user);

	return {
		...shell,
		// The root layout owns the only <title> in the document; a route says who
		// it is by contributing `meta` here. Four rooms used to share one tab
		// title and one share card.
		meta: { description: shell.room.description, title: shell.room.name },
		lazy: {
			roomContent: runWithRequestDbConnection(
				async () =>
					loadGalleryRoomContent(shell.roomId, locals.user, {
						adultContentEnabled: (await parent()).adultContentEnabled
					}),
				{
					connectionString: platform?.env?.HYPERDRIVE?.connectionString,
					context: platform?.context
				}
			)
		}
	};
};
