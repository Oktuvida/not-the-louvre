import type { PageServerLoad } from './$types';
import { runWithRequestDbConnection } from '$lib/server/db';
import { loadGalleryRoomContent, loadGalleryRoomShell } from './gallery-data.server';

// The shell returns synchronously so navigation lands instantly; the room
// content is a nested promise SvelteKit streams once the queries resolve.
// The streamed work outlives the request's own DB connection (hooks close it
// when the response headers go out), so it runs on a connection of its own.
export const load: PageServerLoad = async ({ locals, platform }) => {
	const shell = loadGalleryRoomShell('hall-of-fame', locals.user);

	return {
		...shell,
		lazy: {
			roomContent: runWithRequestDbConnection(
				() => loadGalleryRoomContent(shell.roomId, locals.user),
				{ connectionString: platform?.env?.HYPERDRIVE?.connectionString }
			)
		}
	};
};
