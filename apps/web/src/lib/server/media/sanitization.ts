import sharp from 'sharp';
import {
	ARTWORK_MEDIA_CONTENT_TYPE,
	ARTWORK_MEDIA_HEIGHT,
	ARTWORK_MEDIA_MAX_BYTES,
	ARTWORK_MEDIA_WIDTH
} from '$lib/server/artwork/config';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	AVATAR_MEDIA_CONTENT_TYPE,
	AVATAR_MEDIA_HEIGHT,
	AVATAR_MEDIA_MAX_BYTES,
	AVATAR_MEDIA_WIDTH
} from '$lib/server/user/config';
import type { SanitizedMedia } from '$lib/server/artwork/types';

type MediaSanitizationProfile = {
	contentType: string;
	height: number;
	label: string;
	maxBytes: number;
	outputFileName: string;
	width: number;
};

const CANONICAL_AVIF_OPTIONS = {
	chromaSubsampling: '4:4:4',
	effort: 4,
	quality: 100
} as const;

const artworkProfile: MediaSanitizationProfile = {
	contentType: ARTWORK_MEDIA_CONTENT_TYPE,
	height: ARTWORK_MEDIA_HEIGHT,
	label: 'Artwork',
	maxBytes: ARTWORK_MEDIA_MAX_BYTES,
	outputFileName: 'artwork.avif',
	width: ARTWORK_MEDIA_WIDTH
};

const avatarProfile: MediaSanitizationProfile = {
	contentType: AVATAR_MEDIA_CONTENT_TYPE,
	height: AVATAR_MEDIA_HEIGHT,
	label: 'Avatar',
	maxBytes: AVATAR_MEDIA_MAX_BYTES,
	outputFileName: 'avatar.avif',
	width: AVATAR_MEDIA_WIDTH
};

const invalidContentError = (profile: MediaSanitizationProfile) =>
	new ArtworkFlowError(
		400,
		`${profile.label} media must decode as a single still AVIF image`,
		'INVALID_MEDIA_CONTENT'
	);

const invalidDimensionsError = (profile: MediaSanitizationProfile) =>
	new ArtworkFlowError(
		400,
		`${profile.label} media must be exactly ${profile.width}x${profile.height} pixels`,
		'INVALID_MEDIA_DIMENSIONS'
	);

const oversizedInputError = (profile: MediaSanitizationProfile) =>
	new ArtworkFlowError(
		400,
		`${profile.label} media must be ${profile.maxBytes} bytes or smaller`,
		'MEDIA_TOO_LARGE'
	);

const oversizedOutputError = (profile: MediaSanitizationProfile) =>
	new ArtworkFlowError(
		400,
		`Sanitized ${profile.label.toLowerCase()} media must be ${profile.maxBytes} bytes or smaller`,
		'MEDIA_TOO_LARGE'
	);

export const sanitizeAvifUpload = async (
	file: File,
	profile: MediaSanitizationProfile
): Promise<SanitizedMedia> => {
	if (file.type !== profile.contentType) {
		throw new ArtworkFlowError(400, `${profile.label} media must be AVIF`, 'INVALID_MEDIA_FORMAT');
	}

	if (file.size > profile.maxBytes) {
		throw oversizedInputError(profile);
	}

	const inputBuffer = new Uint8Array(await file.arrayBuffer());
	let metadata;

	try {
		metadata = await sharp(inputBuffer, { animated: false }).metadata();
	} catch {
		throw invalidContentError(profile);
	}

	if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
		throw invalidContentError(profile);
	}

	if (metadata.width !== profile.width || metadata.height !== profile.height) {
		throw invalidDimensionsError(profile);
	}

	let outputBuffer: Buffer;

	try {
		outputBuffer = await sharp(inputBuffer, { animated: false })
			.avif(CANONICAL_AVIF_OPTIONS)
			.toBuffer();
	} catch {
		throw invalidContentError(profile);
	}

	if (outputBuffer.byteLength > profile.maxBytes) {
		throw oversizedOutputError(profile);
	}

	return {
		contentType: profile.contentType,
		file: new File([Uint8Array.from(outputBuffer)], profile.outputFileName, {
			type: profile.contentType
		}),
		height: profile.height,
		sizeBytes: outputBuffer.byteLength,
		width: profile.width
	};
};

export const sanitizeArtworkMedia = (file: File) => sanitizeAvifUpload(file, artworkProfile);

export const sanitizeAvatarMedia = (file: File) => sanitizeAvifUpload(file, avatarProfile);
