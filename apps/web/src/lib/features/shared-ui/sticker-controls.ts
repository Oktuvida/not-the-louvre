import type { StickerVariant } from '$lib/features/home-entry-scene/canvas/museum-canvas';

export type StickerControlVariant = StickerVariant;
export type StickerControlSize = 'hero' | 'lg' | 'md' | 'sm';

export type StickerLinkHref = '/' | '/draw' | '/gallery' | `/gallery/${string}`;

const STICKER_TEXT_COLORS: Record<StickerControlVariant, string> = {
	accent: '#2f241c',
	danger: '#fdfbf7',
	ghost: '#2f241c',
	primary: '#2f241c',
	secondary: '#fdfbf7'
};

const STICKER_SIZE_PRESETS: Record<
	StickerControlSize,
	{
		fontSize: number;
		gap: number;
		height: number;
		iconSize: number;
		minWidth: number;
		paddingX: number;
	}
> = {
	hero: { fontSize: 20, gap: 10, height: 68, iconSize: 28, minWidth: 220, paddingX: 30 },
	lg: { fontSize: 18, gap: 10, height: 64, iconSize: 24, minWidth: 200, paddingX: 28 },
	md: { fontSize: 16, gap: 8, height: 56, iconSize: 20, minWidth: 180, paddingX: 24 },
	sm: { fontSize: 14, gap: 8, height: 48, iconSize: 18, minWidth: 140, paddingX: 18 }
};

export const getStickerControlPreset = (size: StickerControlSize) => STICKER_SIZE_PRESETS[size];

export const getStickerTextColor = (variant: StickerControlVariant) => STICKER_TEXT_COLORS[variant];

export const getStickerControlVars = (size: StickerControlSize, variant: StickerControlVariant) => {
	const preset = getStickerControlPreset(size);

	return [
		`--sticker-height:${preset.height}px`,
		`--sticker-min-width:${preset.minWidth}px`,
		`--sticker-padding-x:${preset.paddingX}px`,
		`--sticker-gap:${preset.gap}px`,
		`--sticker-font-size:${preset.fontSize}px`,
		`--sticker-icon-size:${preset.iconSize}px`,
		`--sticker-text-color:${getStickerTextColor(variant)}`
	].join(';');
};

export const getStickerRotation = (seedInput: string) => {
	let seed = 0;

	for (let index = 0; index < seedInput.length; index += 1) {
		seed = (seed * 16807 + seedInput.charCodeAt(index)) % 2147483647;
	}

	return (((seed || 1) & 0x7fffffff) / 2147483647 - 0.5) * 3;
};
