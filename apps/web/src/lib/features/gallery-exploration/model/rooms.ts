export const galleryRoomIds = ['hall-of-fame', 'hot-wall', 'mystery', 'your-studio'] as const;

export type GalleryRoomId = (typeof galleryRoomIds)[number];

export type GalleryRoomConfig = {
	color: string;
	description: string;
	id: GalleryRoomId;
	name: string;
	shortName: string;
};

export const galleryRooms: GalleryRoomConfig[] = [
	{
		id: 'hall-of-fame',
		name: 'Hall of Fame',
		shortName: 'Fame',
		description: 'Trophy room for the top-ranked artworks the gallery knows about right now.',
		color: '#f4c430'
	},
	{
		id: 'hot-wall',
		name: 'The Hot Wall',
		shortName: 'Hot',
		description: 'Fresh pieces rising fast through the current gallery heat.',
		color: '#c84f4f'
	},
	{
		id: 'mystery',
		name: 'Mystery Room',
		shortName: 'Mystery',
		description: 'Spin through a shuffled set of real gallery discoveries.',
		color: '#8b9d91'
	},
	{
		id: 'your-studio',
		name: 'Your Studio',
		shortName: 'Studio',
		description: 'A quick view of your own published works pulled from the live gallery feed.',
		color: '#d4956c'
	}
];

export const isGalleryRoomId = (value: string): value is GalleryRoomId =>
	galleryRoomIds.includes(value as GalleryRoomId);

export const roomHref = (roomId: GalleryRoomId) =>
	roomId === 'hall-of-fame' ? '/gallery' : `/gallery/${roomId}`;

export const getGalleryRoom = (roomId: GalleryRoomId) =>
	galleryRooms.find((room) => room.id === roomId) ?? galleryRooms[0]!;
