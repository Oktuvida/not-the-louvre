import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { listArtworkDiscovery } from '$lib/server/artwork/read.service';
import { toGalleryArtwork } from '$lib/features/gallery-exploration/gallery-adapter';
import {
	getGalleryRoom,
	isGalleryRoomId,
	type GalleryRoomId
} from '$lib/features/gallery-exploration/model/rooms';

type ProductUser = {
	id: string;
	role: 'admin' | 'moderator' | 'user';
};

type GalleryRoomData = {
	artworks: ReturnType<typeof toGalleryArtwork>[];
	emptyStateMessage: string | null;
	realtimeConfig: {
		anonKey: string | null;
		url: string | null;
	};
	room: ReturnType<typeof getGalleryRoom>;
	roomId: GalleryRoomId;
	viewer: ProductUser | null;
};

const roomDiscoveryRequest = (roomId: GalleryRoomId) => {
	if (roomId === 'hall-of-fame') {
		return { cursor: null, limit: 12, sort: 'top' as const, window: 'all' as const };
	}

	if (roomId === 'hot-wall') {
		return { cursor: null, limit: 12, sort: 'hot' as const, window: null };
	}

	return { cursor: null, limit: 50, sort: 'recent' as const, window: null };
};

const emptyStateMessageForRoom = (roomId: GalleryRoomId) =>
	roomId === 'your-studio'
		? 'You have not published any artworks yet.'
		: 'No artworks have reached this gallery room yet.';

export const loadGalleryRoomData = async (
	roomId: string,
	user?: ProductUser
): Promise<GalleryRoomData> => {
	if (!isGalleryRoomId(roomId)) {
		throw error(404, 'Room not found');
	}

	const room = getGalleryRoom(roomId);
	const discovery = await listArtworkDiscovery(roomDiscoveryRequest(roomId), { user });

	const visibleItems =
		roomId === 'your-studio' && user
			? discovery.items.filter((item) => item.author.id === user.id).slice(0, 12)
			: roomId === 'your-studio'
				? []
				: discovery.items.slice(0, 12);

	return {
		artworks: visibleItems.map((item, index) =>
			toGalleryArtwork(item, roomId === 'hall-of-fame' ? index + 1 : undefined)
		),
		emptyStateMessage: visibleItems.length === 0 ? emptyStateMessageForRoom(roomId) : null,
		realtimeConfig: {
			anonKey: env.PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.ANON_KEY || null,
			url: env.PUBLIC_SUPABASE_URL || env.SUPABASE_PUBLIC_URL || null
		},
		room,
		roomId,
		viewer: user ?? null
	};
};
