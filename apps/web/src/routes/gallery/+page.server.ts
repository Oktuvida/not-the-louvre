import type { PageServerLoad } from './$types';
import { loadGalleryRoomData } from './gallery-data.server';

export const load: PageServerLoad = async ({ locals }) =>
	loadGalleryRoomData('hall-of-fame', locals.user);
