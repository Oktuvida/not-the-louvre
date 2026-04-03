import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

export interface ArtworkAccumulatorOptions {
	initialArtworks: Artwork[];
	initialPageInfo: { hasMore: boolean; nextCursor: string | null };
	fetchPage: (cursor: string) => Promise<{
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
	}>;
	columnCount?: number;
}

export interface ArtworkAccumulator {
	readonly allArtworks: Artwork[];
	readonly rows: Artwork[][];
	readonly hasMore: boolean;
	readonly isLoading: boolean;
	readonly error: string | null;
	loadMore(): Promise<void>;
	retry(): Promise<void>;
	reset(): void;
}

export function createArtworkAccumulator(options: ArtworkAccumulatorOptions): ArtworkAccumulator {
	let appendedArtworks = $state<Artwork[]>([]);
	let pageInfo = $state({ ...options.initialPageInfo });
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	const allArtworks = $derived([...options.initialArtworks, ...appendedArtworks]);

	const columnCount = $derived(typeof options.columnCount === 'number' ? options.columnCount : 3);

	const rows = $derived.by(() => {
		const cols = columnCount;
		const result: Artwork[][] = [];
		for (let i = 0; i < allArtworks.length; i += cols) {
			result.push(allArtworks.slice(i, i + cols));
		}
		return result;
	});

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

	function reset(): void {
		appendedArtworks = [];
		pageInfo = { ...options.initialPageInfo };
		isLoading = false;
		error = null;
	}

	return {
		get allArtworks() {
			return allArtworks;
		},
		get rows() {
			return rows;
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
		reset
	};
}
