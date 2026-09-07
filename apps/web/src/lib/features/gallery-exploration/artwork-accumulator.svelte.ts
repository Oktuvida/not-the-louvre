import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import type {
	GalleryArtworkPage,
	GalleryPageInfo
} from '$lib/features/gallery-exploration/model/discovery';

/*
 * The paging engine behind every gallery room, including the Mystery reel —
 * which used to run a byte-identical fork of this module (`streaming-accumulator`)
 * whose only addition was a write-only `progress` field.
 *
 * The base/appended split is what lets a streamed seed refresh (a realtime vote,
 * an `invalidateAll`) patch the first page in place without discarding the pages
 * infinite scroll has already fetched.
 */

export interface ArtworkAccumulatorOptions {
	initialArtworks: Artwork[];
	initialPageInfo: GalleryPageInfo;
	fetchPage: (cursor: string) => Promise<GalleryArtworkPage>;
}

export interface ArtworkAccumulator {
	readonly allArtworks: Artwork[];
	readonly pageInfo: GalleryPageInfo;
	readonly hasMore: boolean;
	readonly isLoading: boolean;
	readonly error: string | null;
	loadMore(): Promise<void>;
	retry(): Promise<void>;
	reseed(initialArtworks: Artwork[], initialPageInfo: GalleryPageInfo): void;
	syncSeedArtworks(initialArtworks: Artwork[]): void;
}

export function createArtworkAccumulator(options: ArtworkAccumulatorOptions): ArtworkAccumulator {
	let baseArtworks = $state<Artwork[]>([...options.initialArtworks]);
	let appendedArtworks = $state<Artwork[]>([]);
	let pageInfo = $state<GalleryPageInfo>({ ...options.initialPageInfo });
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	const allArtworks = $derived([...baseArtworks, ...appendedArtworks]);

	async function loadMore(): Promise<void> {
		if (isLoading || !pageInfo.hasMore || !pageInfo.nextCursor) return;

		isLoading = true;
		error = null;

		try {
			const result = await options.fetchPage(pageInfo.nextCursor);

			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- ephemeral dedup, not reactive state
			const existingIds = new Set(allArtworks.map((a) => a.id));
			const newArtworks = result.artworks.filter((a) => !existingIds.has(a.id));

			appendedArtworks = [...appendedArtworks, ...newArtworks];
			pageInfo = { ...result.pageInfo };
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load artworks';
		} finally {
			isLoading = false;
		}
	}

	async function retry(): Promise<void> {
		error = null;
		await loadMore();
	}

	function reseed(initialArtworks: Artwork[], initialPageInfo: GalleryPageInfo): void {
		baseArtworks = [...initialArtworks];
		appendedArtworks = [];
		pageInfo = { ...initialPageInfo };
		isLoading = false;
		error = null;
	}

	function syncSeedArtworks(initialArtworks: Artwork[]): void {
		const nextArtworksById = Object.fromEntries(
			initialArtworks.map((artwork) => [artwork.id, artwork])
		) as Record<string, Artwork>;
		baseArtworks = baseArtworks.map(
			(existingArtwork) => nextArtworksById[existingArtwork.id] ?? existingArtwork
		);
	}

	return {
		get allArtworks() {
			return allArtworks;
		},
		get pageInfo() {
			return pageInfo;
		},
		get hasMore() {
			return pageInfo.hasMore;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
		loadMore,
		retry,
		reseed,
		syncSeedArtworks
	};
}
