import type { PageServerLoad } from './$types';
import { loadGalleryRoomContent, loadGalleryRoomShell } from '../gallery-data.server';

// The shell returns synchronously so navigation lands instantly; the room
// content is a nested promise SvelteKit streams once the queries resolve.
export const load: PageServerLoad = async ({ locals, params }) => {
	const shell = loadGalleryRoomShell(params.room, locals.user);

	return {
		...shell,
		lazy: { roomContent: loadGalleryRoomContent(shell.roomId, locals.user) }
	};
};
