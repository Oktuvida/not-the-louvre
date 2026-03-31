import type { PageServerLoad } from './$types';
import { loadGalleryRoomData } from '../gallery-data.server';

export const load: PageServerLoad = async ({ locals, params }) =>
	loadGalleryRoomData(params.room, locals.user);
