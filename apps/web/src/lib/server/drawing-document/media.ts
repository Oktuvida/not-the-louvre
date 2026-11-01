import {
	assertDrawingDocumentWithinLimits,
	type DrawingDocument
} from '#lib/features/stroke-json/document.js';
import { drawingDocumentToSvg } from '#lib/features/stroke-json/svg.js';
import {
	ARTWORK_MEDIA_CONTENT_TYPE,
	ARTWORK_MEDIA_HEIGHT,
	ARTWORK_MEDIA_MAX_BYTES,
	ARTWORK_MEDIA_WIDTH
} from '#lib/server/artwork/config.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import type { SanitizedMedia } from '#lib/server/artwork/types.js';
import {
	coverResize,
	decodeImage,
	encodeLosslessWebp,
	renderSvgToRaster,
	sniffImageFormat,
	type RawImage
} from '#lib/server/media/codecs/index.js';
import {
	AVATAR_MEDIA_CONTENT_TYPE,
	AVATAR_MEDIA_HEIGHT,
	AVATAR_MEDIA_MAX_BYTES,
	AVATAR_MEDIA_WIDTH
} from '#lib/server/user/config.js';

/** Rendered strokes (premultiplied, as resvg returns them) laid over an opaque image. */
const layOver = (strokes: RawImage, backdrop: RawImage): RawImage => {
	const data = new Uint8ClampedArray(backdrop.data);
	for (let index = 0; index < data.length; index += 4) {
		const cover = 1 - strokes.data[index + 3]! / 255;
		data[index] = strokes.data[index]! + data[index]! * cover;
		data[index + 1] = strokes.data[index + 1]! + data[index + 1]! * cover;
		data[index + 2] = strokes.data[index + 2]! + data[index + 2]! * cover;
		data[index + 3] = 255;
	}
	return { data, height: backdrop.height, width: backdrop.width };
};

const decodeBackdrop = async (bytes: Uint8Array, target: { height: number; width: number }) => {
	const format = sniffImageFormat(bytes);
	if (!format) {
		throw new ArtworkFlowError(400, 'Fork parent image is not readable', 'INVALID_FORK_PARENT');
	}
	const image = await decodeImage(bytes, format);
	return image.width === target.width && image.height === target.height
		? image
		: coverResize(image, target);
};

const renderDocumentToMedia = async (
	document: DrawingDocument,
	options: {
		/** The image a fork was drawn on: its strokes are painted over it. */
		backdrop?: Uint8Array;
		contentType: string;
		height: number;
		kind: DrawingDocument['kind'];
		label: 'artwork' | 'avatar';
		maxBytes: number;
		outputFileName: string;
		width: number;
	}
): Promise<SanitizedMedia> => {
	if (document.kind !== options.kind) {
		throw new ArtworkFlowError(
			400,
			`Drawing document kind must be ${options.kind}`,
			'INVALID_MEDIA_FORMAT'
		);
	}

	assertDrawingDocumentWithinLimits(document);

	const target = { height: options.height, width: options.width };
	// On its own, the SVG paints an opaque paper rect and needs no flattening;
	// a fork's strokes go onto the image of the artwork it was drawn on.
	const raster = options.backdrop
		? layOver(
				await renderSvgToRaster(drawingDocumentToSvg(document, { paper: false }), target),
				await decodeBackdrop(options.backdrop, target)
			)
		: await renderSvgToRaster(drawingDocumentToSvg(document), target);

	// Lossless: the stored image is the canonical render of the strokes, pixel
	// for pixel. The lossy AVIF ladder it replaces visibly smeared thin lines.
	const outputBuffer = await encodeLosslessWebp(raster);

	if (outputBuffer.byteLength > options.maxBytes) {
		throw new ArtworkFlowError(
			400,
			`Sanitized ${options.label} media must be ${options.maxBytes} bytes or smaller`,
			'MEDIA_TOO_LARGE'
		);
	}

	return {
		contentType: options.contentType,
		file: new File([Uint8Array.from(outputBuffer)], options.outputFileName, {
			type: options.contentType
		}),
		height: options.height,
		sizeBytes: outputBuffer.byteLength,
		width: options.width
	};
};

export const createArtworkDrawingDocumentMedia = (
	document: DrawingDocument,
	{ backdrop }: { backdrop?: Uint8Array } = {}
) =>
	renderDocumentToMedia(document, {
		backdrop,
		contentType: ARTWORK_MEDIA_CONTENT_TYPE,
		height: ARTWORK_MEDIA_HEIGHT,
		kind: 'artwork',
		label: 'artwork',
		maxBytes: ARTWORK_MEDIA_MAX_BYTES,
		outputFileName: 'artwork.webp',
		width: ARTWORK_MEDIA_WIDTH
	});

export const createAvatarDrawingDocumentMedia = (document: DrawingDocument) =>
	renderDocumentToMedia(document, {
		contentType: AVATAR_MEDIA_CONTENT_TYPE,
		height: AVATAR_MEDIA_HEIGHT,
		kind: 'avatar',
		label: 'avatar',
		maxBytes: AVATAR_MEDIA_MAX_BYTES,
		outputFileName: 'avatar.webp',
		width: AVATAR_MEDIA_WIDTH
	});
