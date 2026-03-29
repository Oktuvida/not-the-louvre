export type ArtworkFrameTier = 'premium' | 'standard';

export type ArtworkPodiumPosition = 1 | 2 | 3;

export interface ArtworkFrameRenderOptions {
	aged?: boolean | number;
	castShadow?: boolean;
	colorScheme?: 'gold' | 'silver' | 'bronze';
	cornerOrnaments?: boolean;
	innerMouldingRatio?: number;
	matRatio?: number;
	mouldingRatio?: number;
}

export interface ArtworkFramePreset {
	id: string;
	markerLabel?: string;
	renderOptions: ArtworkFrameRenderOptions;
	tier: ArtworkFrameTier;
}

export interface ArtworkFrameDescriptor {
	isPremium: boolean;
	preset: ArtworkFramePreset;
	tier: ArtworkFrameTier;
}

export const standardArtworkFramePresets: ArtworkFramePreset[] = [
	{
		id: 'salon-clean',
		renderOptions: {
			aged: false,
			castShadow: true,
			cornerOrnaments: true,
			innerMouldingRatio: 0.4,
			matRatio: 0.35,
			mouldingRatio: 0.08
		},
		tier: 'standard'
	},
	{
		id: 'old-master',
		renderOptions: {
			aged: 0.3,
			castShadow: true,
			cornerOrnaments: true,
			innerMouldingRatio: 0.48,
			matRatio: 0.33,
			mouldingRatio: 0.085
		},
		tier: 'standard'
	},
	{
		id: 'attic-find',
		renderOptions: {
			aged: 0.6,
			castShadow: true,
			cornerOrnaments: true,
			innerMouldingRatio: 0.46,
			matRatio: 0.3,
			mouldingRatio: 0.09
		},
		tier: 'standard'
	},
	{
		id: 'collectors-pick',
		renderOptions: {
			aged: false,
			castShadow: true,
			cornerOrnaments: false,
			innerMouldingRatio: 0.36,
			matRatio: 0.38,
			mouldingRatio: 0.075
		},
		tier: 'standard'
	}
];

export const premiumArtworkFramePresets: ArtworkFramePreset[] = [
	{
		id: 'premium-champion',
		markerLabel: 'PREMIUM',
		renderOptions: {
			aged: false,
			castShadow: true,
			cornerOrnaments: true,
			innerMouldingRatio: 0.52,
			matRatio: 0.28,
			mouldingRatio: 0.1
		},
		tier: 'premium'
	},
	{
		id: 'premium-laurel',
		markerLabel: 'PREMIUM',
		renderOptions: {
			aged: 0.2,
			castShadow: true,
			cornerOrnaments: true,
			innerMouldingRatio: 0.5,
			matRatio: 0.26,
			mouldingRatio: 0.095
		},
		tier: 'premium'
	},
	{
		id: 'premium-victor',
		markerLabel: 'PREMIUM',
		renderOptions: {
			aged: false,
			castShadow: true,
			cornerOrnaments: true,
			innerMouldingRatio: 0.44,
			matRatio: 0.24,
			mouldingRatio: 0.092
		},
		tier: 'premium'
	}
];

export const hashString = (value: string) => {
	let hash = 0;

	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}

	return hash;
};

const pickPreset = (key: string, presets: ArtworkFramePreset[]) =>
	presets[hashString(key) % presets.length] ?? presets[0]!;

export const isPremiumPodiumPosition = (
	podiumPosition?: number | null
): podiumPosition is ArtworkPodiumPosition =>
	podiumPosition === 1 || podiumPosition === 2 || podiumPosition === 3;

export const resolveArtworkFrame = ({
	artworkId,
	podiumPosition
}: {
	artworkId: string;
	podiumPosition?: number | null;
}): ArtworkFrameDescriptor => {
	if (isPremiumPodiumPosition(podiumPosition)) {
		const preset = pickPreset(`${artworkId}:premium:${podiumPosition}`, premiumArtworkFramePresets);
		const colorScheme = podiumPosition === 1 ? 'gold' : podiumPosition === 2 ? 'silver' : 'bronze';

		return {
			isPremium: true,
			preset: {
				...preset,
				renderOptions: {
					...preset.renderOptions,
					colorScheme
				}
			},
			tier: 'premium'
		};
	}

	const preset = pickPreset(`${artworkId}:standard`, standardArtworkFramePresets);

	return {
		isPremium: false,
		preset,
		tier: 'standard'
	};
};
