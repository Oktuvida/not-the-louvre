import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

export interface StreamingAccumulatorOptions {
	initialArtworks: Artwork[];
	initialPageInfo: { hasMore: boolean; nextCursor: string | null };
	fetchPage: (cursor: string) => Promise<{
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
	}>;
}

export interface StreamingAccumulator {
	readonly allArtworks: Artwork[];
	readonly hasMore: boolean;
	readonly isLoading: boolean;
	readonly error: string | null;
	readonly progress: number;
	loadMore(): Promise<void>;
	retry(): Promise<void>;
	reseed(artworks: Artwork[], pageInfo: { hasMore: boolean; nextCursor: string | null }): void;
	setProgress(value: number): void;
}

export function createStreamingAccumulator(
	options: StreamingAccumulatorOptions
): StreamingAccumulator {
	let poolArtworks = $state<Artwork[]>([...options.initialArtworks]);
	let pageInfo = $state({ ...options.initialPageInfo });
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let progress = $state(0);

	async function loadMore(): Promise<void> {
		if (isLoading || !pageInfo.hasMore || !pageInfo.nextCursor) return;

		isLoading = true;
		error = null;

		try {
			const result = await options.fetchPage(pageInfo.nextCursor);

			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- ephemeral dedup, not reactive state
			const existingIds = new Set(poolArtworks.map((a) => a.id));
			const newArtworks = result.artworks.filter((a) => !existingIds.has(a.id));

			poolArtworks = [...poolArtworks, ...newArtworks];
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

	function reseed(
		artworks: Artwork[],
		newPageInfo: { hasMore: boolean; nextCursor: string | null }
	): void {
		poolArtworks = [...artworks];
		pageInfo = { ...newPageInfo };
		isLoading = false;
		error = null;
		progress = 0;
	}

	function setProgress(value: number): void {
		progress = Math.max(0, Math.min(1, value));
	}

	return {
		get allArtworks() {
			return poolArtworks;
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
		get progress() {
			return progress;
		},
		loadMore,
		retry,
		reseed,
		setProgress
	};
}
