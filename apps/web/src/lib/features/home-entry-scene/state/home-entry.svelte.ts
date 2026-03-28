export interface HomePreviewCard {
	id: string;
	title: string;
	artist: string;
	artistAvatar: string;
	imageUrl: string;
	rank: number;
	accent: string;
	rotation: number;
}

export const homePreviewCards: HomePreviewCard[] = [
	{
		id: 'sunset-over-mountains',
		title: 'Sunset Over Mountains',
		artist: 'PaintMaster42',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PaintMaster42',
		imageUrl:
			'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&auto=format&fit=crop',
		rank: 1,
		accent: '#f3c64c',
		rotation: -2
	},
	{
		id: 'abstract-dreams',
		title: 'Abstract Dreams',
		artist: 'ArtisticSoul',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ArtisticSoul',
		imageUrl:
			'https://images.unsplash.com/photo-1549887534-1541e9326642?w=600&q=80&auto=format&fit=crop',
		rank: 2,
		accent: '#d79f6d',
		rotation: 2
	},
	{
		id: 'forest-path',
		title: 'Forest Path',
		artist: 'ColorWhisperer',
		artistAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ColorWhisperer',
		imageUrl:
			'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80&auto=format&fit=crop',
		rank: 3,
		accent: '#7d9785',
		rotation: -2
	}
];

export const homeFloatingPaint = ['#d4834a', '#71917f', '#d9b07b', '#a24d49', '#8f6a49'];
