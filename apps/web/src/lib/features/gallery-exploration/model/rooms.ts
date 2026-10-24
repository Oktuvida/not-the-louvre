// Room identity and hrefs are shared vocabulary (the server loaders resolve
// route params with them); this module keeps the presentation config and
// re-exports the vocabulary so the existing importers keep working.
import type { GalleryRoomId } from '#lib/shared/gallery/rooms.js';

export {
	galleryRoomIds,
	isGalleryRoomId,
	roomHref,
	roomIdForPath
} from '#lib/shared/gallery/rooms.js';
export type { GalleryRoomId } from '#lib/shared/gallery/rooms.js';

export type GalleryRoomConfig = {
	color: string;
	description: string;
	id: GalleryRoomId;
	name: string;
	postItAttachment: 'pin' | 'tape';
	postItColor: string;
	shortName: string;
};

export const galleryRooms: GalleryRoomConfig[] = [
	{
		id: 'hall-of-fame',
		name: 'Hall of Fame',
		shortName: 'Fame',
		postItAttachment: 'tape',
		postItColor: '#f6df65',
		description: 'Trophy room for the top-ranked artworks the gallery knows about right now.',
		color: '#f4c430'
	},
	{
		id: 'hot-wall',
		name: 'The Hot Wall',
		shortName: 'Hot',
		postItAttachment: 'pin',
		postItColor: '#f4aacb',
		description: 'Fresh pieces rising fast through the current gallery heat.',
		color: '#c84f4f'
	},
	{
		id: 'mystery',
		name: 'Mystery Room',
		shortName: 'Mystery',
		postItAttachment: 'tape',
		postItColor: '#9bd3f7',
		description: 'Spin through a shuffled set of real gallery discoveries.',
		color: '#8b9d91'
	},
	{
		id: 'your-studio',
		name: 'Your Studio',
		shortName: 'Studio',
		postItAttachment: 'pin',
		postItColor: '#95d67a',
		description: 'A quick view of your own published works pulled from the live gallery feed.',
		color: '#d4956c'
	}
];

export const getGalleryRoom = (roomId: GalleryRoomId) =>
	galleryRooms.find((room) => room.id === roomId) ?? galleryRooms[0]!;
