import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';

export interface GalleryRoomConfig {
	id: GalleryRoomId;
	name: string;
	shortName: string;
	description: string;
	color: string;
}

export const mockArtworks: Artwork[] = [
	{
		id: '1',
		title: 'Sunset Over Mountains',
		artist: 'PaintMaster42',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PaintMaster42',
		imageUrl:
			'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=80&auto=format&fit=crop',
		score: 2847,
		upvotes: 2960,
		downvotes: 113,
		timestamp: Date.now() - 86400000,
		rank: 1,
		comments: [
			{
				id: 'c1',
				author: 'ArtLover',
				text: 'Absolutely stunning! Love the color palette.',
				timestamp: Date.now() - 3600000
			},
			{
				id: 'c2',
				author: 'PixelPainter',
				text: 'The composition is perfect!',
				timestamp: Date.now() - 7200000
			}
		]
	},
	{
		id: '2',
		title: 'Abstract Dreams',
		artist: 'ArtisticSoul',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ArtisticSoul',
		imageUrl:
			'https://images.unsplash.com/photo-1549887534-1541e9326642?w=900&q=80&auto=format&fit=crop',
		score: 2341,
		upvotes: 2489,
		downvotes: 148,
		timestamp: Date.now() - 172800000,
		rank: 2,
		comments: [
			{ id: 'c3', author: 'ModernArt', text: 'So creative!', timestamp: Date.now() - 5400000 }
		]
	},
	{
		id: '3',
		title: 'Forest Path',
		artist: 'ColorWhisperer',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ColorWhisperer',
		imageUrl:
			'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=900&q=80&auto=format&fit=crop',
		score: 1876,
		upvotes: 1932,
		downvotes: 56,
		timestamp: Date.now() - 259200000,
		rank: 3,
		comments: [
			{ id: 'c4', author: 'GreenThumb', text: 'Takes me there!', timestamp: Date.now() - 9000000 },
			{ id: 'c5', author: 'HikerArt', text: 'Beautiful depth!', timestamp: Date.now() - 10800000 }
		]
	},
	{
		id: '4',
		title: 'Ocean Waves',
		artist: 'SeaPainter',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SeaPainter',
		imageUrl:
			'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=900&q=80&auto=format&fit=crop',
		score: 1654,
		upvotes: 1702,
		downvotes: 48,
		timestamp: Date.now() - 345600000,
		rank: 4,
		comments: []
	},
	{
		id: '5',
		title: 'City Lights',
		artist: 'UrbanArtist',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=UrbanArtist',
		imageUrl:
			'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=900&q=80&auto=format&fit=crop',
		score: 1432,
		upvotes: 1511,
		downvotes: 79,
		timestamp: Date.now() - 432000000,
		rank: 5,
		comments: [
			{
				id: 'c6',
				author: 'NightOwl',
				text: 'Captures the vibe perfectly!',
				timestamp: Date.now() - 14400000
			}
		]
	},
	{
		id: '6',
		title: 'Minimalist Portrait',
		artist: 'SimpleLine',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SimpleLine',
		imageUrl:
			'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=900&q=80&auto=format&fit=crop',
		score: 1287,
		upvotes: 1320,
		downvotes: 33,
		timestamp: Date.now() - 518400000,
		rank: 6,
		comments: []
	},
	{
		id: '7',
		title: 'Geometric Chaos',
		artist: 'ShapeShifter',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ShapeShifter',
		imageUrl:
			'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=900&q=80&auto=format&fit=crop',
		score: 1156,
		upvotes: 1203,
		downvotes: 47,
		timestamp: Date.now() - 604800000,
		rank: 7,
		comments: [
			{ id: 'c7', author: 'MathArt', text: 'Love the angles!', timestamp: Date.now() - 18000000 }
		]
	},
	{
		id: '8',
		title: 'Desert Dunes',
		artist: 'SandArtist',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SandArtist',
		imageUrl:
			'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=900&q=80&auto=format&fit=crop',
		score: 987,
		upvotes: 1024,
		downvotes: 37,
		timestamp: Date.now() - 691200000,
		rank: 8,
		comments: []
	},
	{
		id: '9',
		title: 'Rainy Window',
		artist: 'MoodMaker',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MoodMaker',
		imageUrl:
			'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=900&q=80&auto=format&fit=crop',
		score: 876,
		upvotes: 912,
		downvotes: 36,
		timestamp: Date.now() - 777600000,
		rank: 9,
		comments: [
			{
				id: 'c8',
				author: 'Melancholy',
				text: 'So moody and perfect.',
				timestamp: Date.now() - 21600000
			}
		]
	},
	{
		id: '10',
		title: 'Cosmic Swirl',
		artist: 'SpaceCadet',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SpaceCadet',
		imageUrl:
			'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=900&q=80&auto=format&fit=crop',
		score: 765,
		upvotes: 798,
		downvotes: 33,
		timestamp: Date.now() - 864000000,
		rank: 10,
		comments: []
	},
	{
		id: '11',
		title: 'Morning Coffee',
		artist: 'CozyArtist',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CozyArtist',
		imageUrl:
			'https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?w=900&q=80&auto=format&fit=crop',
		score: 654,
		upvotes: 689,
		downvotes: 35,
		timestamp: Date.now() - 950400000,
		comments: [
			{
				id: 'c9',
				author: 'CaffeineLover',
				text: 'I can smell it!',
				timestamp: Date.now() - 25200000
			}
		]
	},
	{
		id: '12',
		title: 'Autumn Leaves',
		artist: 'FallFan',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=FallFan',
		imageUrl:
			'https://images.unsplash.com/photo-1475113548554-5a36f1f523d6?w=900&q=80&auto=format&fit=crop',
		score: 543,
		upvotes: 571,
		downvotes: 28,
		timestamp: Date.now() - 1036800000,
		comments: []
	}
];

export const topRanked = mockArtworks.slice(0, 10);
export const trendingArtworks = mockArtworks.slice(0, 6);
export const yourStudioArtworks = mockArtworks.slice(2, 6);
export const randomArtworks = [...mockArtworks].sort(() => Math.random() - 0.5);

export const galleryRooms: GalleryRoomConfig[] = [
	{
		id: 'hall-of-fame',
		name: 'Hall of Fame',
		shortName: 'Fame',
		description:
			'\u{1F3C6} The most legendary artworks of all time, immortalized in digital paint.',
		color: '#f4c430'
	},
	{
		id: 'hot-wall',
		name: 'The Hot Wall',
		shortName: 'Hot',
		description: '\u{1F525} Fresh off the easel! These pieces are trending right now.',
		color: '#c84f4f'
	},
	{
		id: 'mystery',
		name: 'Mystery Room',
		shortName: 'Mystery',
		description: '\u{1F3B2} Spin the wheel of art! Random discoveries await...',
		color: '#8b9d91'
	},
	{
		id: 'your-studio',
		name: 'Your Studio',
		shortName: 'Studio',
		description: '\u{1F3A8} Your personal collection and masterpieces.',
		color: '#d4956c'
	}
];

export const artworksByRoom = {
	'hall-of-fame': topRanked,
	'hot-wall': trendingArtworks,
	mystery: randomArtworks,
	'your-studio': yourStudioArtworks
} satisfies Record<GalleryRoomId, Artwork[]>;
