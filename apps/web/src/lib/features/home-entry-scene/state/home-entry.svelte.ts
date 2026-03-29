export interface HomePreviewCard {
	id: string;
	title: string;
	artist: string;
	artistAvatar?: string;
	imageUrl: string;
	rank: number;
	accent: string;
	rotation: number;
}

export type HomeSceneArtworkSlotName =
	| 'a1'
	| 'a2'
	| 'a3'
	| 'a4'
	| 'a5'
	| 'a6'
	| 'a7'
	| 'a8'
	| 'a9'
	| 'a10'
	| 'a11';

export interface HomeSceneArtworkSlot {
	id: string;
	imageUrl: string;
	slotName: HomeSceneArtworkSlotName;
	title: string;
}

type HomePreviewSource = {
	author: { avatarUrl: string | null; nickname: string };
	id: string;
	mediaUrl: string;
	title: string;
};

const previewAccents = ['#f3c64c', '#d79f6d', '#7d9785'] as const;
const previewRotations = [-2, 2, -2] as const;
const homeSceneArtworkSlotNames = [
	'a1',
	'a2',
	'a3',
	'a4',
	'a5',
	'a6',
	'a7',
	'a8',
	'a9',
	'a10',
	'a11'
] as const satisfies readonly HomeSceneArtworkSlotName[];

export const toHomePreviewCards = (artworks: HomePreviewSource[]): HomePreviewCard[] =>
	artworks.slice(0, 3).map((artwork, index) => ({
		accent: previewAccents[index] ?? previewAccents[previewAccents.length - 1],
		artist: artwork.author.nickname,
		artistAvatar: artwork.author.avatarUrl ?? undefined,
		id: artwork.id,
		imageUrl: artwork.mediaUrl,
		rank: index + 1,
		rotation: previewRotations[index] ?? 0,
		title: artwork.title
	}));

export const toHomeSceneArtworkSlots = (artworks: HomePreviewSource[]): HomeSceneArtworkSlot[] =>
	artworks.slice(-homeSceneArtworkSlotNames.length).map((artwork, index) => ({
		id: artwork.id,
		imageUrl: artwork.mediaUrl,
		slotName: homeSceneArtworkSlotNames[index] ?? homeSceneArtworkSlotNames[0],
		title: artwork.title
	}));

export const homeFloatingPaint = ['#d4834a', '#71917f', '#d9b07b', '#a24d49', '#8f6a49'];
