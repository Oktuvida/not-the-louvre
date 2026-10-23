import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';

/*
 * The one Artwork factory for the gallery specs.
 *
 * This module used to hold 270 lines of Unsplash demo data that nothing
 * imported, including a second `galleryRooms` and a second `GalleryRoomConfig`
 * under the same names as the live ones — so grep and autocomplete kept
 * offering the wrong module. Room configuration lives in `model/rooms.ts` and
 * is not restated here. Meanwhile eight specs had each grown their own
 * `makeArtwork`/`createArtwork`, disagreeing on which optional fields exist, so
 * a change to the `Artwork` model could pass in one suite and fail in another
 * for reasons unrelated to the code under test.
 */

const DEFAULT_TIMESTAMP = 1_700_000_000_000;

export const makeArtwork = (overrides: Partial<Artwork> & { id: string }): Artwork => ({
	artist: `artist-${overrides.id}`,
	artistAvatar: undefined,
	authorId: `user-${overrides.id}`,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	imageUrl: `https://example.com/${overrides.id}.avif`,
	isNsfw: false,
	score: 0,
	timestamp: DEFAULT_TIMESTAMP,
	title: `Artwork ${overrides.id}`,
	upvotes: 0,
	viewerVote: null,
	...overrides
});

export const makeArtworks = (
	count: number,
	options: { prefix?: string; overrides?: (index: number) => Partial<Artwork> } = {}
): Artwork[] => {
	const prefix = options.prefix ?? 'artwork-';

	return Array.from({ length: count }, (_, index) =>
		makeArtwork({ id: `${prefix}${index + 1}`, ...options.overrides?.(index) })
	);
};
