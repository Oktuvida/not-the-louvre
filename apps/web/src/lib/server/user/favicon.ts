import {
	applyRoundedRectAlpha,
	coverResize,
	cropCenter,
	decodeImage,
	encodePng,
	sniffImageFormat
} from '#lib/server/media/codecs/index.js';
import { AVATAR_FAVICON_SIZE } from '#lib/favicon.js';

// The rounding of the icon's corners, as a share of its side.
const FAVICON_RADIUS_SHARE = 18 / 64;
const FAVICON_ZOOM_FACTOR = 1.22;

/** `size`: the icon's side; by default the one the favicon's link declares (`avatarFavicon`). */
export const renderAvatarFaviconPng = async (
	input: Buffer | Uint8Array | ArrayBuffer,
	size = AVATAR_FAVICON_SIZE
) => {
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
	const format = sniffImageFormat(bytes);

	if (!format) {
		throw new Error('Avatar media has an unsupported image format');
	}

	const zoomedSize = Math.ceil(size * FAVICON_ZOOM_FACTOR);
	const decoded = await decodeImage(bytes, format);
	const zoomed = await coverResize(decoded, { height: zoomedSize, width: zoomedSize });
	const cropped = cropCenter(zoomed, size, size);
	const rounded = applyRoundedRectAlpha(cropped, Math.round(size * FAVICON_RADIUS_SHARE));

	return encodePng(rounded);
};
