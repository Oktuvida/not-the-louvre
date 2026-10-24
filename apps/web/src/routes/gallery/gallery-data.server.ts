import { error, redirect } from '@sveltejs/kit';
import { listArtworkDiscovery } from '#lib/server/artwork/read.service.js';
import { getViewerContentPreferences } from '#lib/server/moderation/service.js';
import { toGalleryArtwork } from '#lib/features/gallery-exploration/gallery-adapter.js';
import type { GalleryRoomContent } from '#lib/features/gallery-exploration/model/discovery.js';
import {
	getGalleryRoom,
	isGalleryRoomId,
	type GalleryRoomId
} from '#lib/features/gallery-exploration/model/rooms.js';
import type { Viewer } from '#lib/shared/viewer.js';

type ProductUser = Viewer;

// The room payload shape is shared with the page component that consumes it.
export type { GalleryRoomContent };

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

// The Hot Wall is deliberately absent: it renders its own two-line empty state
// (`HotWallRoom.svelte`) and the page never falls back to this copy for it, so a
// hot-wall branch here was a second, unreachable voice for the same moment.
const emptyStateMessageForRoom = (roomId: GalleryRoomId) =>
	roomId === 'your-studio'
		? 'You have not published any artworks yet.'
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
		room: getGalleryRoom(roomId),
		roomId: roomId as GalleryRoomId,
		viewer: user ?? null
	};
};

export const loadGalleryRoomContent = async (
	roomId: GalleryRoomId,
	user?: ProductUser,
	// The root layout already read the viewer's preference row for this
	// request; when the caller passes it down, the room content stops issuing
	// the identical single-row query a second time (on Workers, on its own
	// connection). Omitting it falls back to reading the row here.
	options: { adultContentEnabled?: boolean } = {}
): Promise<GalleryRoomContent> => {
	const discoveryRequest = roomDiscoveryRequest(roomId, user);
	const [discovery, viewerContentPreferences] = await Promise.all([
		listArtworkDiscovery(discoveryRequest, { user }),
		options.adultContentEnabled !== undefined
			? Promise.resolve({ adultContentEnabled: options.adultContentEnabled })
			: user
				? getViewerContentPreferences({ user })
				: Promise.resolve({ adultContentEnabled: false })
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
