import {
	ARTWORK_MEDIA_CONTENT_TYPE,
	ARTWORK_MEDIA_HEIGHT,
	ARTWORK_MEDIA_MAX_BYTES,
	ARTWORK_MEDIA_WIDTH
} from '$lib/server/artwork/config';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { SanitizedMedia } from '$lib/server/artwork/types';
import {
	containOnBackground,
	decodeImage,
	encodeAvif,
	hasAvifMagicBytes,
	hasWebpMagicBytes,
	isAnimatedImage,
	mimeTypeForImageFormat,
	parseHexColor,
	sniffImageFormat,
	type AvifEncodeSettings,
	type RawImage
} from '$lib/server/media/codecs';
import {
	AVATAR_MEDIA_CONTENT_TYPE,
	AVATAR_MEDIA_HEIGHT,
	AVATAR_MEDIA_MAX_BYTES,
	AVATAR_UPLOAD_CONTENT_TYPE,
	AVATAR_MEDIA_WIDTH
} from '$lib/server/user/config';

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

const CANONICAL_AVIF_OPTIONS: AvifEncodeSettings = {
	chromaSubsampling: '4:4:4',
	quality: 100
};

const ARTWORK_CANONICAL_AVIF_ATTEMPTS: ReadonlyArray<AvifEncodeSettings> = [
	{ chromaSubsampling: '4:2:0', quality: 70 },
	{ chromaSubsampling: '4:2:0', quality: 55 },
	{ chromaSubsampling: '4:2:0', quality: 42 },
	{ chromaSubsampling: '4:2:0', quality: 32 }
];

const ARTWORK_CANVAS_BACKGROUND = parseHexColor('#fdfbf7');

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

export { hasAvifMagicBytes, hasWebpMagicBytes };

const decodeStillImage = async (
	inputBuffer: Uint8Array,
	expectedContentType: string,
	profile: MediaSanitizationProfile
) => {
	const format = sniffImageFormat(inputBuffer);

	if (!format || mimeTypeForImageFormat(format) !== expectedContentType) {
		throw invalidContentError(profile);
	}

	if (isAnimatedImage(inputBuffer, format)) {
		throw invalidContentError(profile);
	}

	let image: RawImage;

	try {
		image = await decodeImage(inputBuffer, format);
	} catch {
		throw invalidContentError(profile);
	}

	if (!image.width || !image.height) {
		throw invalidContentError(profile);
	}

	return image;
};

const encodeCanonicalAvif = async (image: RawImage) => encodeAvif(image, CANONICAL_AVIF_OPTIONS);

const encodeCanonicalArtworkAvif = async (image: RawImage) => {
	const contained = await containOnBackground(image, {
		background: ARTWORK_CANVAS_BACKGROUND,
		height: artworkProfile.height,
		width: artworkProfile.width
	});

	for (const avifOptions of ARTWORK_CANONICAL_AVIF_ATTEMPTS) {
		const outputBuffer = await encodeAvif(contained, avifOptions);

		if (outputBuffer.byteLength <= artworkProfile.maxBytes) {
			return outputBuffer;
		}
	}

	throw oversizedOutputError(artworkProfile);
};

const toSanitizedMedia = (
	outputBuffer: Uint8Array,
	profile: MediaSanitizationProfile
): SanitizedMedia => ({
	contentType: profile.contentType,
	file: new File([Uint8Array.from(outputBuffer)], profile.outputFileName, {
		type: profile.contentType
	}),
	height: profile.height,
	sizeBytes: outputBuffer.byteLength,
	width: profile.width
});

const sanitizeDecodedImageUpload = async (
	file: File,
	profile: MediaSanitizationProfile,
	options: {
		encodeOutput?: (image: RawImage, profile: MediaSanitizationProfile) => Promise<Uint8Array>;
		expectInput: (inputBuffer: Uint8Array) => boolean;
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

	const image = await decodeStillImage(inputBuffer, file.type, profile);

	if (image.width !== profile.width || image.height !== profile.height) {
		throw invalidDimensionsError(profile);
	}

	let outputBuffer: Uint8Array;

	try {
		outputBuffer = await (options.encodeOutput
			? options.encodeOutput(image, profile)
			: encodeCanonicalAvif(image));
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			throw error;
		}

		throw invalidContentError(profile);
	}

	if (outputBuffer.byteLength > profile.maxBytes) {
		throw oversizedOutputError(profile);
	}

	return toSanitizedMedia(outputBuffer, profile);
};

export const sanitizeAvifUpload = async (
	file: File,
	profile: MediaSanitizationProfile,
	options?: {
		encodeOutput?: (image: RawImage, profile: MediaSanitizationProfile) => Promise<Uint8Array>;
	}
): Promise<SanitizedMedia> =>
	sanitizeDecodedImageUpload(file, profile, {
		encodeOutput: options?.encodeOutput,
		expectInput: hasAvifMagicBytes
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
	const image = await decodeStillImage(inputBuffer, file.type, artworkProfile);

	let outputBuffer: Uint8Array;

	try {
		outputBuffer = await encodeCanonicalArtworkAvif(image);
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			throw error;
		}

		throw invalidContentError(artworkProfile);
	}

	return toSanitizedMedia(outputBuffer, artworkProfile);
};

export const sanitizeAvatarMedia = (file: File) =>
	sanitizeDecodedImageUpload(file, avatarProfile, {
		expectInput: hasWebpMagicBytes
	});
