import { ARTWORK_TITLE_MAX_LENGTH } from './config';
import { ArtworkFlowError } from './errors';

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
