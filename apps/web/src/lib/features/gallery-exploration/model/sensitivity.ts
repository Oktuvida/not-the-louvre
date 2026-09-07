/*
 * One predicate for "is this artwork blurred for this viewer".
 *
 * The rule used to be written out in every surface that renders artwork, and
 * the copies drifted: the Mystery reel checked only `isNsfw && !adultContent`,
 * so an author saw their own 18+ piece blurred and a reveal made in the grid
 * was ignored on the reel. `authorId` and `revealedIds` are optional so the
 * home preview cards — which have neither — can call the same helper.
 */

export type SensitiveArtwork = {
	id: string;
	isNsfw: boolean;
	authorId?: string | null;
};

export type SensitivityViewer = {
	adultContentEnabled: boolean;
	id?: string | null;
	revealedIds?: ReadonlySet<string> | null;
};

export const isArtworkBlurred = (artwork: SensitiveArtwork, viewer: SensitivityViewer): boolean => {
	if (!artwork.isNsfw) return false;
	if (viewer.adultContentEnabled) return false;
	// Authors always see their own work.
	if (artwork.authorId && viewer.id && artwork.authorId === viewer.id) return false;
	return !viewer.revealedIds?.has(artwork.id);
};
