export interface HomePreviewCard {
	id: string;
	title: string;
	artist: string;
	artistAvatar?: string;
	imageUrl: string;
	isNsfw: boolean;
	rank: number;
	accent: string;
	rotation: number;
}

type HomePreviewSource = {
	author: { avatarUrl: string | null; nickname: string };
	id: string;
	isNsfw: boolean;
	mediaUrl: string;
	title: string;
};

const previewAccents = ['#f3c64c', '#d79f6d', '#7d9785'] as const;
const previewRotations = [-2, 2, -2] as const;

export const toHomePreviewCards = (artworks: HomePreviewSource[]): HomePreviewCard[] =>
	artworks.slice(0, 3).map((artwork, index) => ({
		accent: previewAccents[index] ?? previewAccents[previewAccents.length - 1],
		artist: artwork.author.nickname,
		artistAvatar: artwork.author.avatarUrl ?? undefined,
		id: artwork.id,
		imageUrl: artwork.mediaUrl,
		isNsfw: artwork.isNsfw,
		rank: index + 1,
		rotation: previewRotations[index] ?? 0,
		title: artwork.title
	}));

export const homeFloatingPaint = ['#d4834a', '#71917f', '#d9b07b', '#a24d49', '#8f6a49'];
