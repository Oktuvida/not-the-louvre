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

const ARTWORK_CANONICAL_AVIF_ATTEMPTS = [
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 70 },
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 55 },
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 42 },
	{ chromaSubsampling: '4:2:0', effort: 4, quality: 32 }
] as const;

const ARTWORK_SOURCE_CONTENT_TYPES = new Set([
	'image/avif',
	'image/webp',
	'image/jpeg',
	'image/png'
]);

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
	inputDescription: 'WebP',
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
const WEBP_RIFF = 'RIFF';
const WEBP_BRAND = 'WEBP';

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

const hasWebpMagicBytes = (input: Uint8Array) => {
	if (input.byteLength < 12) {
		return false;
	}

	return readAscii(input, 0, 4) === WEBP_RIFF && readAscii(input, 8, 4) === WEBP_BRAND;
};

const expectedMimeTypeForMetadata = (metadata: sharp.Metadata) => {
	if (metadata.format === 'jpeg') {
		return 'image/jpeg';
	}

	if (metadata.format === 'png') {
		return 'image/png';
	}

	if (metadata.format === 'webp') {
		return 'image/webp';
	}

	if (metadata.format === 'heif' && metadata.compression === 'av1') {
		return 'image/avif';
	}

	return null;
};

const isCanonicalAvif = (metadata: sharp.Metadata) =>
	metadata.format === 'heif' && metadata.compression === 'av1';

const hasExpectedDimensions = (metadata: sharp.Metadata, profile: MediaSanitizationProfile) =>
	metadata.width === profile.width && metadata.height === profile.height;

const encodeCanonicalAvif = async (inputBuffer: Uint8Array) =>
	sharp(inputBuffer, { animated: false }).avif(CANONICAL_AVIF_OPTIONS).toBuffer();

const encodeCanonicalArtworkAvif = async (inputBuffer: Uint8Array) => {
	for (const avifOptions of ARTWORK_CANONICAL_AVIF_ATTEMPTS) {
		const outputBuffer = await sharp(inputBuffer, { animated: false })
			.resize(artworkProfile.width, artworkProfile.height, {
				background: '#fdfbf7',
				fit: 'contain'
			})
			.flatten({ background: '#fdfbf7' })
			.avif(avifOptions)
			.toBuffer();

		if (outputBuffer.byteLength <= artworkProfile.maxBytes) {
			return outputBuffer;
		}
	}

	throw oversizedOutputError(artworkProfile);
};

const sanitizeDecodedImageUpload = async (
	file: File,
	profile: MediaSanitizationProfile,
	options: {
		encodeOutput?: (inputBuffer: Uint8Array, profile: MediaSanitizationProfile) => Promise<Buffer>;
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

	if (expectedMimeTypeForMetadata(metadata) !== file.type) {
		throw invalidContentError(profile);
	}

	if (!hasExpectedDimensions(metadata, profile)) {
		throw invalidDimensionsError(profile);
	}

	let outputBuffer: Buffer;

	try {
		outputBuffer = await (options.encodeOutput
			? options.encodeOutput(inputBuffer, profile)
			: encodeCanonicalAvif(inputBuffer));
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			throw error;
		}

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
	profile: MediaSanitizationProfile,
	options?: {
		encodeOutput?: (inputBuffer: Uint8Array, profile: MediaSanitizationProfile) => Promise<Buffer>;
	}
): Promise<SanitizedMedia> =>
	sanitizeDecodedImageUpload(file, profile, {
		encodeOutput: options?.encodeOutput,
		expectInput: hasAvifMagicBytes,
		isValidMetadata: isCanonicalAvif
	});

export const sanitizeArtworkMedia = async (file: File) => {
	if (!ARTWORK_SOURCE_CONTENT_TYPES.has(file.type)) {
		throw new ArtworkFlowError(
			400,
			'Artwork media must be AVIF, WebP, JPEG, or PNG',
			'INVALID_MEDIA_FORMAT'
		);
	}

	if (file.type === artworkProfile.contentType) {
		return sanitizeAvifUpload(file, artworkProfile, {
			encodeOutput: encodeCanonicalArtworkAvif
		});
	}

	if (file.size > artworkProfile.maxBytes) {
		throw oversizedInputError(artworkProfile);
	}

	const inputBuffer = new Uint8Array(await file.arrayBuffer());

	let metadata: sharp.Metadata;

	try {
		metadata = await sharp(inputBuffer, { animated: false }).metadata();
	} catch {
		throw invalidContentError(artworkProfile);
	}

	if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
		throw invalidContentError(artworkProfile);
	}

	if (expectedMimeTypeForMetadata(metadata) !== file.type) {
		throw invalidContentError(artworkProfile);
	}

	let outputBuffer: Buffer;

	try {
		outputBuffer = await encodeCanonicalArtworkAvif(inputBuffer);
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			throw error;
		}

		throw invalidContentError(artworkProfile);
	}

	return {
		contentType: artworkProfile.contentType,
		file: new File([Uint8Array.from(outputBuffer)], artworkProfile.outputFileName, {
			type: artworkProfile.contentType
		}),
		height: artworkProfile.height,
		sizeBytes: outputBuffer.byteLength,
		width: artworkProfile.width
	};
};

export const sanitizeAvatarMedia = (file: File) =>
	sanitizeDecodedImageUpload(file, avatarProfile, {
		expectInput: hasWebpMagicBytes,
		isValidMetadata: (metadata) => metadata.format === 'webp'
	});
