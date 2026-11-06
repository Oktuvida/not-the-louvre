import type { StickerVariant } from '../home-entry-scene/canvas/museum-canvas';
import { GENERATED_ART_VERSION } from './generated-art-version';
import type { StickerControlSize } from './sticker-controls';

/*
 * The museum wall, the window frame and the sticker backgrounds are built by
 * pure SVG string builders in `home-entry-scene/canvas/museum-canvas.ts`. They
 * used to be inlined as `data:` URLs, which put ~110-190KB of uncacheable
 * markup into every SSR document. `scripts/generate-static-art.ts` now writes
 * them to `static/generated/` at build time and everything references them by
 * URL, so the browser caches one copy across routes and visitors.
 *
 * The filenames carry a version segment, and the assets are served with a
 * year-long immutable cache lifetime (see `apps/web/_headers`). That header is
 * only honest because the segment is a digest of the artwork itself, written
 * by the generator: edit a builder and every URL changes with it, so a
 * returning visitor can never be served last week's wall from their cache.
 */
export { GENERATED_ART_VERSION };

export const MUSEUM_WALL_ASSET_NAME = 'museum-wall';

export const MUSEUM_WINDOW_FRAME_ASSET_NAME = 'museum-window-frame';

const generatedArtUrl = (name: string) => `/generated/${name}.${GENERATED_ART_VERSION}.svg`;

export const STICKER_CONTROL_SIZES: readonly StickerControlSize[] = ['hero', 'lg', 'md', 'sm'];

export const STICKER_VARIANTS: readonly StickerVariant[] = [
	'primary',
	'secondary',
	'accent',
	'danger',
	'ghost'
];

/** The front door's cut-out title, one file per layout (see `cutout-title.ts`). */
export const CUTOUT_TITLE_ASSET_NAMES = {
	stacked: 'cutout-title-stacked',
	wide: 'cutout-title-wide'
} as const;

export const cutoutTitleAssetUrl = (layout: keyof typeof CUTOUT_TITLE_ASSET_NAMES) =>
	generatedArtUrl(CUTOUT_TITLE_ASSET_NAMES[layout]);

export const museumWallPatternAssetUrl = generatedArtUrl(MUSEUM_WALL_ASSET_NAME);

export const museumWindowFrameAssetUrl = generatedArtUrl(MUSEUM_WINDOW_FRAME_ASSET_NAME);

export const stickerBackgroundAssetName = (size: StickerControlSize, variant: StickerVariant) =>
	`sticker-${size}-${variant}`;

export const stickerBackgroundAssetUrl = (size: StickerControlSize, variant: StickerVariant) =>
	generatedArtUrl(stickerBackgroundAssetName(size, variant));
