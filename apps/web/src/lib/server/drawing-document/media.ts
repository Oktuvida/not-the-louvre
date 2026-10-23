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
	encodeAvif,
	renderSvgToRaster,
	type AvifEncodeSettings,
	type RawImage
} from '#lib/server/media/codecs/index.js';
import { encodeArtworkMediaPlaceholder } from '#lib/server/media/sanitization.js';
import {
	AVATAR_MEDIA_CONTENT_TYPE,
	AVATAR_MEDIA_HEIGHT,
	AVATAR_MEDIA_MAX_BYTES,
	AVATAR_MEDIA_WIDTH
} from '#lib/server/user/config.js';

const ARTWORK_CANONICAL_AVIF_ATTEMPTS: ReadonlyArray<AvifEncodeSettings> = [
	{ chromaSubsampling: '4:2:0', quality: 70 },
	{ chromaSubsampling: '4:2:0', quality: 55 },
	{ chromaSubsampling: '4:2:0', quality: 42 },
	{ chromaSubsampling: '4:2:0', quality: 32 }
];

const AVATAR_CANONICAL_AVIF_ATTEMPTS: ReadonlyArray<AvifEncodeSettings> = [
	{ chromaSubsampling: '4:4:4', quality: 90 },
	{ chromaSubsampling: '4:4:4', quality: 75 },
	{ chromaSubsampling: '4:2:0', quality: 60 }
];

const renderDocumentToAvif = async (
	document: DrawingDocument,
	options: {
		attempts: ReadonlyArray<AvifEncodeSettings>;
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

	// Encoded from the same raster the AVIF attempts consume, and before them,
	// so the blur-up colors always match the final media and no encoder call can
	// have consumed the buffer first.
	const placeholder = options.encodePlaceholder ? await options.encodePlaceholder(raster) : null;

	for (const avifOptions of options.attempts) {
		const outputBuffer = await encodeAvif(raster, avifOptions);

		if (outputBuffer.byteLength <= options.maxBytes) {
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
		}
	}

	throw new ArtworkFlowError(
		400,
		`Sanitized ${options.label} media must be ${options.maxBytes} bytes or smaller`,
		'MEDIA_TOO_LARGE'
	);
};

export const createArtworkDrawingDocumentMedia = (document: DrawingDocument) =>
	renderDocumentToAvif(document, {
		attempts: ARTWORK_CANONICAL_AVIF_ATTEMPTS,
		contentType: ARTWORK_MEDIA_CONTENT_TYPE,
		encodePlaceholder: encodeArtworkMediaPlaceholder,
		height: ARTWORK_MEDIA_HEIGHT,
		kind: 'artwork',
		label: 'artwork',
		maxBytes: ARTWORK_MEDIA_MAX_BYTES,
		outputFileName: 'artwork.avif',
		width: ARTWORK_MEDIA_WIDTH
	});

export const createAvatarDrawingDocumentMedia = (document: DrawingDocument) =>
	renderDocumentToAvif(document, {
		attempts: AVATAR_CANONICAL_AVIF_ATTEMPTS,
		contentType: AVATAR_MEDIA_CONTENT_TYPE,
		height: AVATAR_MEDIA_HEIGHT,
		kind: 'avatar',
		label: 'avatar',
		maxBytes: AVATAR_MEDIA_MAX_BYTES,
		outputFileName: 'avatar.avif',
		width: AVATAR_MEDIA_WIDTH
	});
