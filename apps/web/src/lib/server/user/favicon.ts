import {
	applyRoundedRectAlpha,
	coverResize,
	cropCenter,
	decodeImage,
	encodePng,
	sniffImageFormat
} from '$lib/server/media/codecs';

const FAVICON_SIZE = 64;
const FAVICON_RADIUS = 18;
const FAVICON_ZOOM_FACTOR = 1.22;

export const renderAvatarFaviconPng = async (input: Buffer | Uint8Array | ArrayBuffer) => {
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
	const format = sniffImageFormat(bytes);

	if (!format) {
		throw new Error('Avatar media has an unsupported image format');
	}

	const zoomedSize = Math.ceil(FAVICON_SIZE * FAVICON_ZOOM_FACTOR);
	const decoded = await decodeImage(bytes, format);
	const zoomed = await coverResize(decoded, { height: zoomedSize, width: zoomedSize });
	const cropped = cropCenter(zoomed, FAVICON_SIZE, FAVICON_SIZE);
	const rounded = applyRoundedRectAlpha(cropped, FAVICON_RADIUS);

	return encodePng(rounded);
};
