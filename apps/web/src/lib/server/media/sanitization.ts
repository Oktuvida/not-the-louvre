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
	AVATAR_UPLOAD_CONTENT_TYPE,
	AVATAR_MEDIA_WIDTH
} from '$lib/server/user/config';
import type { SanitizedMedia } from '$lib/server/artwork/types';

type MediaSanitizationProfile = {
	contentType: string;
	height: number;
	inputDescription: string;
	inputType: string;
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
	inputDescription: 'AVIF',
	inputType: ARTWORK_MEDIA_CONTENT_TYPE,
	label: 'Artwork',
	maxBytes: ARTWORK_MEDIA_MAX_BYTES,
	outputFileName: 'artwork.avif',
	width: ARTWORK_MEDIA_WIDTH
};

const avatarProfile: MediaSanitizationProfile = {
	contentType: AVATAR_MEDIA_CONTENT_TYPE,
	height: AVATAR_MEDIA_HEIGHT,
	inputDescription: 'PNG',
	inputType: AVATAR_UPLOAD_CONTENT_TYPE,
	label: 'Avatar',
	maxBytes: AVATAR_MEDIA_MAX_BYTES,
	outputFileName: 'avatar.avif',
	width: AVATAR_MEDIA_WIDTH
};

const invalidContentError = (profile: MediaSanitizationProfile) =>
	new ArtworkFlowError(
		400,
		`${profile.label} media must decode as a single still ${profile.inputDescription} image`,
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

const ISO_BMFF_FTYP_OFFSET = 4;
const ISO_BMFF_BRAND_OFFSET = 8;
const ISO_BMFF_HEADER_BYTES = 16;
const ISO_BMFF_BRAND_BYTES = 4;
const AVIF_BRANDS = new Set(['avif', 'avis']);
const PNG_SIGNATURE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const readAscii = (input: Uint8Array, start: number, length: number) =>
	String.fromCharCode(...input.subarray(start, start + length));

const hasAvifMagicBytes = (input: Uint8Array) => {
	if (input.byteLength < ISO_BMFF_HEADER_BYTES) {
		return false;
	}

	if (readAscii(input, ISO_BMFF_FTYP_OFFSET, ISO_BMFF_BRAND_BYTES) !== 'ftyp') {
		return false;
	}

	const majorBrand = readAscii(input, ISO_BMFF_BRAND_OFFSET, ISO_BMFF_BRAND_BYTES);
	if (AVIF_BRANDS.has(majorBrand)) {
		return true;
	}

	for (
		let offset = ISO_BMFF_HEADER_BYTES;
		offset + ISO_BMFF_BRAND_BYTES <= input.byteLength;
		offset += 4
	) {
		if (AVIF_BRANDS.has(readAscii(input, offset, ISO_BMFF_BRAND_BYTES))) {
			return true;
		}
	}

	return false;
};

const hasPngMagicBytes = (input: Uint8Array) => {
	if (input.byteLength < PNG_SIGNATURE_BYTES.byteLength) {
		return false;
	}

	for (let index = 0; index < PNG_SIGNATURE_BYTES.byteLength; index += 1) {
		if (input[index] !== PNG_SIGNATURE_BYTES[index]) {
			return false;
		}
	}

	return true;
};

const isCanonicalAvif = (metadata: sharp.Metadata) =>
	metadata.format === 'heif' && metadata.compression === 'av1';

const hasExpectedDimensions = (metadata: sharp.Metadata, profile: MediaSanitizationProfile) =>
	metadata.width === profile.width && metadata.height === profile.height;

const sanitizeDecodedImageUpload = async (
	file: File,
	profile: MediaSanitizationProfile,
	options: {
		expectInput: (inputBuffer: Uint8Array) => boolean;
		isValidMetadata: (metadata: sharp.Metadata) => boolean;
	}
): Promise<SanitizedMedia> => {
	if (file.type !== profile.inputType) {
		throw new ArtworkFlowError(
			400,
			`${profile.label} media must be ${profile.inputDescription}`,
			'INVALID_MEDIA_FORMAT'
		);
	}

	if (file.size > profile.maxBytes) {
		throw oversizedInputError(profile);
	}

	const inputBuffer = new Uint8Array(await file.arrayBuffer());

	if (!options.expectInput(inputBuffer)) {
		throw invalidContentError(profile);
	}

	let metadata;

	try {
		metadata = await sharp(inputBuffer, { animated: false }).metadata();
	} catch {
		throw invalidContentError(profile);
	}

	if (!options.isValidMetadata(metadata)) {
		throw invalidContentError(profile);
	}

	if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
		throw invalidContentError(profile);
	}

	if (!hasExpectedDimensions(metadata, profile)) {
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

export const sanitizeAvifUpload = async (
	file: File,
	profile: MediaSanitizationProfile
): Promise<SanitizedMedia> =>
	sanitizeDecodedImageUpload(file, profile, {
		expectInput: hasAvifMagicBytes,
		isValidMetadata: isCanonicalAvif
	});

export const sanitizeArtworkMedia = (file: File) => sanitizeAvifUpload(file, artworkProfile);

export const sanitizeAvatarMedia = (file: File) =>
	sanitizeDecodedImageUpload(file, avatarProfile, {
		expectInput: hasPngMagicBytes,
		isValidMetadata: (metadata) => metadata.format === 'png'
	});
