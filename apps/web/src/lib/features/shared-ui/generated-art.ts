import type { StickerVariant } from '../home-entry-scene/canvas/museum-canvas';
import type { StickerControlSize } from './sticker-controls';

/*
 * The museum wall, the window frame and the sticker backgrounds are built by
 * pure SVG string builders in `home-entry-scene/canvas/museum-canvas.ts`. They
 * used to be inlined as `data:` URLs, which put ~110-190KB of uncacheable
 * markup into every SSR document. `scripts/generate-static-art.ts` now writes
 * them to `static/generated/` at build time and everything references them by
 * URL, so the browser caches one copy across routes and visitors.
 *
 * The filenames carry a version segment: the assets are served with a long
 * immutable cache lifetime (see `apps/web/_headers`), so bumping this constant
 * is what makes a change to the artwork reach returning visitors.
 */
export const GENERATED_ART_VERSION = 'v1';

const generatedArtUrl = (name: string) => `/generated/${name}.${GENERATED_ART_VERSION}.svg`;

export const STICKER_CONTROL_SIZES: readonly StickerControlSize[] = ['hero', 'lg', 'md', 'sm'];

export const STICKER_VARIANTS: readonly StickerVariant[] = [
	'primary',
	'secondary',
	'accent',
	'danger',
	'ghost'
];

export const museumWallPatternAssetUrl = generatedArtUrl('museum-wall');

export const museumWindowFrameAssetUrl = generatedArtUrl('museum-window-frame');

export const stickerBackgroundAssetName = (size: StickerControlSize, variant: StickerVariant) =>
	`sticker-${size}-${variant}`;

export const stickerBackgroundAssetUrl = (size: StickerControlSize, variant: StickerVariant) =>
	generatedArtUrl(stickerBackgroundAssetName(size, variant));
