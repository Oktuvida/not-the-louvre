import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

export interface BoundedPoolAccumulatorOptions {
	initialArtworks: Artwork[];
	initialPageInfo: { hasMore: boolean; nextCursor: string | null };
	fetchPage: (cursor: string) => Promise<{
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
	}>;
	capacity: number;
	pageSize: number;
}

export interface BoundedPoolAccumulator {
	readonly allArtworks: Artwork[];
	readonly hasMore: boolean;
	readonly isLoading: boolean;
	readonly error: string | null;
	readonly hasPendingEviction: boolean;
	loadMore(): Promise<void>;
	retry(): Promise<void>;
	reseed(
		initialArtworks: Artwork[],
		initialPageInfo: { hasMore: boolean; nextCursor: string | null }
	): void;
	applyPendingEviction(): void;
}

export function createBoundedPoolAccumulator(
	options: BoundedPoolAccumulatorOptions
): BoundedPoolAccumulator {
	let poolArtworks = $state<Artwork[]>([...options.initialArtworks]);
	let pageInfo = $state({ ...options.initialPageInfo });
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let hasPendingEviction = $state(false);

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

			if (poolArtworks.length > options.capacity) {
				hasPendingEviction = true;
			}
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
		initialArtworks: Artwork[],
		initialPageInfo: { hasMore: boolean; nextCursor: string | null }
	): void {
		poolArtworks = [...initialArtworks];
		pageInfo = { ...initialPageInfo };
		isLoading = false;
		error = null;
		hasPendingEviction = false;
	}

	function applyPendingEviction(): void {
		if (!hasPendingEviction) return;

		while (poolArtworks.length > options.capacity) {
			poolArtworks = poolArtworks.slice(options.pageSize);
		}
		hasPendingEviction = false;
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
		get hasPendingEviction() {
			return hasPendingEviction;
		},
		loadMore,
		retry,
		reseed,
		applyPendingEviction
	};
}
