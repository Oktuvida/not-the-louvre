export const galleryRoomIds = ['hall-of-fame', 'hot-wall', 'mystery', 'your-studio'] as const;

export type GalleryRoomId = (typeof galleryRoomIds)[number];

export const isGalleryRoomId = (value: string): value is GalleryRoomId =>
	galleryRoomIds.includes(value as GalleryRoomId);

export const roomHref = (roomId: GalleryRoomId) =>
	roomId === 'hall-of-fame' ? '/gallery' : `/gallery/${roomId}`;
