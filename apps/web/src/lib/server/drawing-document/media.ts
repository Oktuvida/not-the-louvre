import {
	assertDrawingDocumentWithinLimits,
	type DrawingDocument
} from '$lib/features/stroke-json/document';
import { drawingDocumentToSvg } from '$lib/features/stroke-json/svg';
import {
	ARTWORK_MEDIA_CONTENT_TYPE,
	ARTWORK_MEDIA_HEIGHT,
	ARTWORK_MEDIA_MAX_BYTES,
	ARTWORK_MEDIA_WIDTH
} from '$lib/server/artwork/config';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { SanitizedMedia } from '$lib/server/artwork/types';
import { encodeAvif, renderSvgToRaster, type AvifEncodeSettings } from '$lib/server/media/codecs';
import {
	AVATAR_MEDIA_CONTENT_TYPE,
	AVATAR_MEDIA_HEIGHT,
	AVATAR_MEDIA_MAX_BYTES,
	AVATAR_MEDIA_WIDTH
} from '$lib/server/user/config';

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

	for (const avifOptions of options.attempts) {
		const outputBuffer = await encodeAvif(raster, avifOptions);

		if (outputBuffer.byteLength <= options.maxBytes) {
			return {
				contentType: options.contentType,
				file: new File([Uint8Array.from(outputBuffer)], options.outputFileName, {
					type: options.contentType
				}),
				height: options.height,
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
