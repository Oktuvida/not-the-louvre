import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import { listArtworkDiscovery } from '$lib/server/artwork/read.service';
import { getViewerContentPreferences } from '$lib/server/moderation/service';
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
	discovery: {
		pageInfo: {
			hasMore: boolean;
			nextCursor: string | null;
		};
		request: {
			authorId: string | null;
			limit: number;
			sort: 'hot' | 'recent' | 'top';
			window: 'all' | null;
		};
	};
	emptyStateMessage: string | null;
	realtimeConfig: {
		anonKey: string | null;
		url: string | null;
	};
	room: ReturnType<typeof getGalleryRoom>;
	roomId: GalleryRoomId;
	adultContentEnabled: boolean;
	viewer: ProductUser | null;
};

const SCALABLE_GALLERY_PAGE_SIZE = 24;

const roomDiscoveryRequest = (roomId: GalleryRoomId, user?: ProductUser) => {
	if (roomId === 'hall-of-fame') {
		return { cursor: null, limit: 12, sort: 'top' as const, window: 'all' as const };
	}

	if (roomId === 'hot-wall') {
		return { cursor: null, limit: SCALABLE_GALLERY_PAGE_SIZE, sort: 'hot' as const, window: null };
	}

	if (roomId === 'your-studio' && user) {
		return {
			authorId: user.id,
			cursor: null,
			limit: SCALABLE_GALLERY_PAGE_SIZE,
			sort: 'recent' as const,
			window: null
		};
	}

	return { cursor: null, limit: SCALABLE_GALLERY_PAGE_SIZE, sort: 'recent' as const, window: null };
};

const emptyStateMessageForRoom = (roomId: GalleryRoomId) =>
	roomId === 'your-studio'
		? 'You have not published any artworks yet.'
		: roomId === 'hot-wall'
			? 'Nothing is heating up on the wall right now.'
			: 'No artworks have reached this gallery room yet.';

// The shell resolves without touching the database, so navigations render
// the room chrome immediately while the artwork content streams in.
export const loadGalleryRoomShell = (roomId: string, user?: ProductUser) => {
	if (!isGalleryRoomId(roomId)) {
		throw error(404, 'Room not found');
	}

	if (roomId === 'your-studio' && !user) {
		throw redirect(302, '/gallery');
	}

	return {
		realtimeConfig: {
			anonKey: env.PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.ANON_KEY || null,
			url: env.PUBLIC_SUPABASE_URL || env.SUPABASE_PUBLIC_URL || null
		},
		room: getGalleryRoom(roomId),
		roomId: roomId as GalleryRoomId,
		viewer: user ?? null
	};
};

export type GalleryRoomContent = Pick<
	GalleryRoomData,
	'adultContentEnabled' | 'artworks' | 'discovery' | 'emptyStateMessage'
>;

export const loadGalleryRoomContent = async (
	roomId: GalleryRoomId,
	user?: ProductUser
): Promise<GalleryRoomContent> => {
	const discoveryRequest = roomDiscoveryRequest(roomId, user);
	const [discovery, viewerContentPreferences] = await Promise.all([
		listArtworkDiscovery(discoveryRequest, { user }),
		user ? getViewerContentPreferences({ user }) : Promise.resolve({ adultContentEnabled: false })
	]);

	const visibleItems = (
		roomId === 'your-studio' && user
			? discovery.items.filter((item) => item.author.id === user.id)
			: discovery.items
	).slice(0, discoveryRequest.limit);

	return {
		artworks: visibleItems.map((item, index) =>
			toGalleryArtwork(item, roomId === 'hall-of-fame' ? index + 1 : undefined)
		),
		discovery: {
			pageInfo: discovery.pageInfo,
			request: {
				authorId: (roomId === 'your-studio' && user?.id) || null,
				limit: discoveryRequest.limit,
				sort: discoveryRequest.sort,
				window: discoveryRequest.window
			}
		},
		emptyStateMessage: visibleItems.length === 0 ? emptyStateMessageForRoom(roomId) : null,
		adultContentEnabled: viewerContentPreferences.adultContentEnabled
	};
};

export const loadGalleryRoomData = async (
	roomId: string,
	user?: ProductUser
): Promise<GalleryRoomData> => {
	const shell = loadGalleryRoomShell(roomId, user);
	const content = await loadGalleryRoomContent(shell.roomId, user);

	return { ...shell, ...content };
};
