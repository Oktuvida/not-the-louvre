import sharp from 'sharp';
import {
	assertDrawingDocumentWithinLimits,
	type DrawingDocumentV1
} from '$lib/features/stroke-json/document';
import { drawingDocumentToSvg } from '$lib/features/stroke-json/svg';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	ARTWORK_MEDIA_CONTENT_TYPE,
	ARTWORK_MEDIA_HEIGHT,
	ARTWORK_MEDIA_MAX_BYTES,
	ARTWORK_MEDIA_WIDTH
} from '$lib/server/artwork/config';
import type { SanitizedMedia } from '$lib/server/artwork/types';
import {
	AVATAR_MEDIA_CONTENT_TYPE,
	AVATAR_MEDIA_HEIGHT,
	AVATAR_MEDIA_MAX_BYTES,
	AVATAR_MEDIA_WIDTH
} from '$lib/server/user/config';

const ARTWORK_CANONICAL_AVIF_ATTEMPTS = [
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 70 },
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 55 },
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 42 },
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 32 }
] as const;

const AVATAR_CANONICAL_AVIF_ATTEMPTS = [
	{ chromaSubsampling: '4:4:4', effort: 4, quality: 90 },
	{ chromaSubsampling: '4:4:4', effort: 4, quality: 75 },
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 60 }
] as const;

const renderDocumentToAvif = async (
	document: DrawingDocumentV1,
	options: {
		attempts: ReadonlyArray<{
			chromaSubsampling: '4:2:0' | '4:4:4';
			effort: number;
			quality: number;
		}>;
		contentType: string;
		height: number;
		kind: DrawingDocumentV1['kind'];
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
	const svgBuffer = Buffer.from(drawingDocumentToSvg(document));

	for (const avifOptions of options.attempts) {
		const outputBuffer = await sharp(svgBuffer, { density: 144 })
			.resize(options.width, options.height, {
				background: document.background,
				fit: 'fill'
			})
			.flatten({ background: document.background })
			.avif(avifOptions)
			.toBuffer();

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

export const createArtworkDrawingDocumentMedia = (document: DrawingDocumentV1) =>
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

export const createAvatarDrawingDocumentMedia = (document: DrawingDocumentV1) =>
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
