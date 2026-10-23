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
	encodeLosslessWebp,
	renderSvgToRaster,
	type RawImage
} from '#lib/server/media/codecs/index.js';
import { encodeArtworkMediaPlaceholder } from '#lib/server/media/placeholder.js';
import {
	AVATAR_MEDIA_CONTENT_TYPE,
	AVATAR_MEDIA_HEIGHT,
	AVATAR_MEDIA_MAX_BYTES,
	AVATAR_MEDIA_WIDTH
} from '#lib/server/user/config.js';

const renderDocumentToMedia = async (
	document: DrawingDocument,
	options: {
		contentType: string;
		// Only the artwork variant has a placeholder column, so the avatar path
		// leaves this unset instead of paying the extra resize plus PNG encode.
		encodePlaceholder?: (raster: RawImage) => Promise<string>;
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

	// The generated SVG paints an opaque background rect, so the raster needs
	// no extra flattening before encoding.
	const raster = await renderSvgToRaster(drawingDocumentToSvg(document), {
		height: options.height,
		width: options.width
	});

	// Encoded from the same raster the image is, and before it, so the blur-up
	// colors always match the final media and the encoder cannot have consumed
	// the buffer first.
	const placeholder = options.encodePlaceholder ? await options.encodePlaceholder(raster) : null;

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
		placeholder,
		sizeBytes: outputBuffer.byteLength,
		width: options.width
	};
};

export const createArtworkDrawingDocumentMedia = (document: DrawingDocument) =>
	renderDocumentToMedia(document, {
		contentType: ARTWORK_MEDIA_CONTENT_TYPE,
		encodePlaceholder: encodeArtworkMediaPlaceholder,
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
