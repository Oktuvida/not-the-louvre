import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { isGalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';

export const load: PageLoad = ({ params }) => {
	if (!isGalleryRoomId(params.room)) {
		error(404, 'Room not found');
	}

	return {
		roomId: params.room
	};
};
