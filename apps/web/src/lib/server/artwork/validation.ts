import {
	ARTWORK_MEDIA_CONTENT_TYPE,
	ARTWORK_MEDIA_MAX_BYTES,
	ARTWORK_TITLE_MAX_LENGTH
} from './config';
import { ArtworkFlowError } from './errors';

const AVIF_BRAND = 'ftypavif';

const trimTitle = (title: string) => title.trim();

export const createUntitledArtworkTitle = (suffix: number) =>
	`Untitled #${String(suffix).padStart(4, '0')}`;

export const normalizePublishTitle = (title: string | null | undefined, suffix: number) => {
	const trimmed = trimTitle(title ?? '');

	if (!trimmed) {
		return createUntitledArtworkTitle(suffix);
	}

	if (trimmed.length > ARTWORK_TITLE_MAX_LENGTH) {
		throw new ArtworkFlowError(
			400,
			`Title must be ${ARTWORK_TITLE_MAX_LENGTH} characters or fewer`,
			'INVALID_TITLE'
		);
	}

	return trimmed;
};

export const normalizeUpdatedTitle = (title: string) => {
	const trimmed = trimTitle(title);

	if (!trimmed || trimmed.length > ARTWORK_TITLE_MAX_LENGTH) {
		throw new ArtworkFlowError(
			400,
			`Title must be between 1 and ${ARTWORK_TITLE_MAX_LENGTH} characters`,
			'INVALID_TITLE'
		);
	}

	return trimmed;
};

const hasAvifSignature = (bytes: Uint8Array) => {
	const signature = new TextDecoder().decode(bytes.subarray(0, 32));
	return signature.includes(AVIF_BRAND);
};

export const validateArtworkMedia = async (file: File) => {
	if (file.type !== ARTWORK_MEDIA_CONTENT_TYPE) {
		throw new ArtworkFlowError(400, 'Artwork media must be AVIF', 'INVALID_MEDIA_FORMAT');
	}

	if (file.size > ARTWORK_MEDIA_MAX_BYTES) {
		throw new ArtworkFlowError(
			400,
			`Artwork media must be ${ARTWORK_MEDIA_MAX_BYTES} bytes or smaller`,
			'MEDIA_TOO_LARGE'
		);
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!hasAvifSignature(bytes)) {
		throw new ArtworkFlowError(400, 'Artwork media must be AVIF', 'INVALID_MEDIA_FORMAT');
	}

	return {
		contentType: file.type,
		sizeBytes: file.size
	};
};
