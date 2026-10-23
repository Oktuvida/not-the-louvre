import { encodePng, resizeImage, type RawImage } from '#lib/server/media/codecs/index.js';

// 24px is enough for a blurred preview and keeps the PNG data URI in the
// low hundreds of bytes, small enough to ride every feed row.
const ARTWORK_PLACEHOLDER_SIZE = 24;

export const encodeArtworkMediaPlaceholder = async (raster: RawImage) => {
	const tiny = await resizeImage(raster, {
		height: ARTWORK_PLACEHOLDER_SIZE,
		width: ARTWORK_PLACEHOLDER_SIZE
	});
	const pngBuffer = await encodePng(tiny);

	return `data:image/png;base64,${Buffer.from(pngBuffer).toString('base64')}`;
};
