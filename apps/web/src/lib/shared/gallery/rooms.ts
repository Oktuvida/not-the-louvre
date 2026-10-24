// Room identity and the URLs that address it: the gallery loaders resolve a
// route parameter with this, and the nav builds its hrefs from it.
export const galleryRoomIds = ['hall-of-fame', 'hot-wall', 'mystery', 'your-studio'] as const;

export type GalleryRoomId = (typeof galleryRoomIds)[number];

export const isGalleryRoomId = (value: string): value is GalleryRoomId =>
	galleryRoomIds.includes(value as GalleryRoomId);

// The narrow literal union is what `GameLink`'s `href` prop accepts; without
// the annotation the template literal widens to `string`.
export const roomHref = (roomId: GalleryRoomId): '/gallery' | `/gallery/${GalleryRoomId}` =>
	roomId === 'hall-of-fame' ? '/gallery' : `/gallery/${roomId}`;

/** The room a pathname addresses, or null outside the rooms. */
export const roomIdForPath = (pathname: string): GalleryRoomId | null => {
	if (pathname === '/gallery') return 'hall-of-fame';

	const roomId = /^\/gallery\/([^/]+)$/.exec(pathname)?.[1];
	return roomId && isGalleryRoomId(roomId) ? roomId : null;
};
